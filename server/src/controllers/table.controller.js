import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { Branch, Order, Restaurant, Table, TableSession, WaiterCall } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signTableToken } from '../utils/signTableToken.js';
import { logActivity } from '../services/activityLog.service.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';

const getBranchFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user.branchId };
};

const buildTableQrUrl = (branchSlug, qrToken) => {
  const cleanClientUrl = env.CLIENT_URL.replace(/\/$/, '');
  return `${cleanClientUrl}/t/${branchSlug}/${qrToken}`;
};

export const listTables = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const branchId = req.query.branchId || req.user.branchId;
  const branch = branchId ? await Branch.findById(branchId) : null;

  const tables = await Table.find(filter).sort({ name: 1 });

  const enriched = tables.map((t) => ({
    ...t.toObject(),
    qrUrl: branch ? buildTableQrUrl(branch.slug, t.qrToken) : null,
  }));

  res.status(200).json({
    success: true,
    data: {
      count: enriched.length,
      tables: enriched,
    },
  });
});

export const createTable = asyncHandler(async (req, res, next) => {
  const branchId =
    req.user.role === 'superadmin' ? req.body.branchId || req.user.branchId : req.user.branchId;

  if (!branchId) {
    return next(new ApiError(400, 'branchId is required.'));
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return next(new ApiError(404, 'Branch not found.'));
  }

  const table = await Table.create({
    branchId,
    name: req.body.name,
    seats: req.body.seats,
    shape: req.body.shape,
    x: req.body.x,
    y: req.body.y,
    section: req.body.section,
    isActive: req.body.isActive,
    qrToken: signTableToken(),
  });

  await logActivity({
    branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLE_CREATED',
    entityType: 'Table',
    entityId: table._id,
    details: { name: table.name, seats: table.seats },
  });

  res.status(201).json({
    success: true,
    data: {
      table: {
        ...table.toObject(),
        qrUrl: buildTableQrUrl(branch.slug, table.qrToken),
      },
    },
  });
});

export const updateTable = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const table = await Table.findOne(filter);

  if (!table) {
    return next(new ApiError(404, 'Table not found.'));
  }

  const fields = ['name', 'seats', 'shape', 'x', 'y', 'section', 'isActive', 'status'];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      table[field] = req.body[field];
    }
  }

  await table.save();
  emitToBranch(table.branchId, 'table:updated', { table });

  await logActivity({
    branchId: table.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLE_UPDATED',
    entityType: 'Table',
    entityId: table._id,
    details: { name: table.name },
  });

  res.status(200).json({
    success: true,
    data: { table },
  });
});

export const deleteTable = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const table = await Table.findOne(filter);

  if (!table) {
    return next(new ApiError(404, 'Table not found.'));
  }

  await table.deleteOne();

  await logActivity({
    branchId: table.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLE_DELETED',
    entityType: 'Table',
    entityId: table._id,
    details: { name: table.name },
  });

  res.status(200).json({
    success: true,
    data: { message: 'Table deleted successfully.' },
  });
});

export const rotateTableQrToken = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const table = await Table.findOne(filter);

  if (!table) {
    return next(new ApiError(404, 'Table not found.'));
  }

  const branch = await Branch.findById(table.branchId);
  table.qrToken = signTableToken();
  await table.save();

  await logActivity({
    branchId: table.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLE_QR_ROTATED',
    entityType: 'Table',
    entityId: table._id,
    details: { name: table.name },
  });

  res.status(200).json({
    success: true,
    data: {
      table: {
        ...table.toObject(),
        qrUrl: branch ? buildTableQrUrl(branch.slug, table.qrToken) : null,
      },
    },
  });
});

export const updateTableLayout = asyncHandler(async (req, res) => {
  const branchFilter = getBranchFilter(req);
  const { tables } = req.body;

  const bulkOps = tables.map((entry) => {
    const updateFields = { x: entry.x, y: entry.y };
    if (entry.shape) updateFields.shape = entry.shape;
    return {
      updateOne: {
        filter: { _id: entry.id, ...branchFilter },
        update: { $set: updateFields },
      },
    };
  });

  await Table.bulkWrite(bulkOps);

  const updatedTables = await Table.find(branchFilter).sort({ name: 1 });

  res.status(200).json({
    success: true,
    data: {
      message: 'Table floor layout saved successfully.',
      tables: updatedTables,
    },
  });
});

export const transferTable = asyncHandler(async (req, res, next) => {
  const branchFilter = getBranchFilter(req);
  const fromTable = await Table.findOne({ _id: req.params.id, ...branchFilter });
  const toTable = await Table.findOne({ _id: req.body.toTableId, ...branchFilter });

  if (!fromTable || !toTable) {
    return next(new ApiError(404, 'Source or destination table not found.'));
  }
  if (String(fromTable._id) === String(toTable._id)) {
    return next(new ApiError(400, 'Cannot transfer a table to itself.'));
  }

  const activeSession = await TableSession.findOne({ tableId: fromTable._id, status: 'OPEN' });
  if (!activeSession) {
    return next(new ApiError(400, `Table ${fromTable.name} does not have an open session.`));
  }

  const targetSession = await TableSession.findOne({ tableId: toTable._id, status: 'OPEN' });
  if (targetSession) {
    return next(
      new ApiError(409, `Destination table ${toTable.name} already has an open session. Use merge instead.`)
    );
  }

  activeSession.tableId = toTable._id;
  await activeSession.save();

  await Promise.all([
    Order.updateMany({ sessionId: activeSession._id }, { $set: { tableId: toTable._id } }),
    WaiterCall.updateMany(
      { tableId: fromTable._id, status: { $in: ['OPEN', 'ACKNOWLEDGED'] } },
      { $set: { tableId: toTable._id } }
    ),
  ]);

  const transferredStatus = fromTable.status === 'EMPTY' ? 'SEATED' : fromTable.status;
  toTable.status = transferredStatus;
  fromTable.status = 'EMPTY';
  await Promise.all([toTable.save(), fromTable.save()]);

  emitToBranch(fromTable.branchId, 'table:updated', { table: fromTable });
  emitToBranch(toTable.branchId, 'table:updated', { table: toTable });
  emitToSession(activeSession._id, 'table:updated', { table: toTable });

  await logActivity({
    branchId: fromTable.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLE_TRANSFERRED',
    entityType: 'Table',
    entityId: fromTable._id,
    details: { from: fromTable.name, to: toTable.name, sessionId: activeSession._id },
  });

  res.status(200).json({
    success: true,
    data: {
      message: `Transferred session from ${fromTable.name} to ${toTable.name}.`,
      fromTable,
      toTable,
      session: activeSession,
    },
  });
});

export const mergeTables = asyncHandler(async (req, res, next) => {
  const branchFilter = getBranchFilter(req);
  const { primaryTableId, secondaryTableIds } = req.body;

  const primaryTable = await Table.findOne({ _id: primaryTableId, ...branchFilter });
  if (!primaryTable) {
    return next(new ApiError(404, 'Primary table not found.'));
  }

  const uniqueSecondaryIds = [...new Set(secondaryTableIds)].filter(
    (id) => String(id) !== String(primaryTableId)
  );
  if (!uniqueSecondaryIds.length) {
    return next(new ApiError(400, 'Provide at least one distinct secondary table to merge.'));
  }

  const secondaryTables = await Table.find({
    _id: { $in: uniqueSecondaryIds },
    ...branchFilter,
  });

  if (secondaryTables.length !== uniqueSecondaryIds.length) {
    return next(new ApiError(404, 'One or more secondary tables were not found.'));
  }

  let primarySession = await TableSession.findOne({ tableId: primaryTable._id, status: 'OPEN' });
  if (!primarySession) {
    primarySession = await TableSession.create({
      branchId: primaryTable.branchId,
      tableId: primaryTable._id,
      status: 'OPEN',
      guests: [{ id: 'guest_host', nickname: 'Host' }],
      cart: [],
    });
  }

  const existingMergedSet = new Set((primarySession.mergedTableIds || []).map(String));

  for (const secTable of secondaryTables) {
    existingMergedSet.add(String(secTable._id));

    const secSession = await TableSession.findOne({ tableId: secTable._id, status: 'OPEN' });
    if (secSession) {
      primarySession.guests.push(...secSession.guests);
      primarySession.cart.push(...secSession.cart);

      await Order.updateMany(
        { sessionId: secSession._id },
        { $set: { sessionId: primarySession._id, tableId: primaryTable._id } }
      );

      secSession.status = 'CLOSED';
      secSession.closedAt = new Date();
      await secSession.save();
    }

    await WaiterCall.updateMany(
      { tableId: secTable._id, status: { $in: ['OPEN', 'ACKNOWLEDGED'] } },
      { $set: { tableId: primaryTable._id } }
    );

    secTable.status = 'SEATED';
    await secTable.save();
    emitToBranch(secTable.branchId, 'table:updated', { table: secTable });
  }

  primarySession.mergedTableIds = Array.from(existingMergedSet);
  await primarySession.save();

  if (primaryTable.status === 'EMPTY') {
    primaryTable.status = 'SEATED';
    await primaryTable.save();
  }
  emitToBranch(primaryTable.branchId, 'table:updated', { table: primaryTable });
  emitToSession(primarySession._id, 'cart:updated', { cart: primarySession.cart });

  await logActivity({
    branchId: primaryTable.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'TABLES_MERGED',
    entityType: 'TableSession',
    entityId: primarySession._id,
    details: {
      primary: primaryTable.name,
      merged: secondaryTables.map((t) => t.name),
    },
  });

  res.status(200).json({
    success: true,
    data: {
      message: `Merged tables into ${primaryTable.name}.`,
      primaryTable,
      session: primarySession,
    },
  });
});

export const getTableQrPng = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const table = await Table.findOne(filter);

  if (!table) {
    return next(new ApiError(404, 'Table not found.'));
  }

  const branch = await Branch.findById(table.branchId);
  if (!branch) {
    return next(new ApiError(404, 'Branch not found.'));
  }

  const qrUrl = buildTableQrUrl(branch.slug, table.qrToken);

  if (req.query.format === 'json') {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#0B0B0C', light: '#FFFFFF' },
    });
    return res.status(200).json({
      success: true,
      data: { tableId: table._id, tableName: table.name, qrUrl, qrDataUrl },
    });
  }

  const pngBuffer = await QRCode.toBuffer(qrUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    color: {
      dark: '#0B0B0C',
      light: '#FFFFFF',
    },
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="table-${table.name}-qr.png"`);
  res.status(200).send(pngBuffer);
});

export const getAllTablesQrSheetPdf = asyncHandler(async (req, res, next) => {
  const branchFilter = getBranchFilter(req);
  const branchId = req.query.branchId || req.user.branchId;

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return next(new ApiError(404, 'Branch not found.'));
  }

  const restaurant = await Restaurant.findById(branch.restaurantId);
  const restaurantName = restaurant?.name || 'Aapka Waiter';

  const tables = await Table.find({ ...branchFilter, isActive: true }).sort({ name: 1 });
  if (!tables.length) {
    return next(new ApiError(404, 'No active tables found to generate QR sheet.'));
  }

  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${branch.slug}-qr-sheet.pdf"`);

  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const cols = 2;
  const rows = 3;
  const perPage = cols * rows;
  const marginX = 36;
  const marginTop = 44;
  const footerHeight = 32;
  const gapX = 20;
  const gapY = 18;

  const usableWidth = pageWidth - marginX * 2 - gapX * (cols - 1);
  const usableHeight = pageHeight - marginTop - footerHeight - 20 - gapY * (rows - 1);
  const cardWidth = usableWidth / cols;
  const cardHeight = usableHeight / rows;

  const drawPageFooter = () => {
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text('Designed & Developed by HeryxStudio', marginX, pageHeight - 30, {
        width: pageWidth - marginX * 2,
        align: 'center',
      });
  };

  for (let i = 0; i < tables.length; i++) {
    if (i > 0 && i % perPage === 0) {
      drawPageFooter();
      doc.addPage();
    }

    const table = tables[i];
    const indexOnPage = i % perPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);

    const x = marginX + col * (cardWidth + gapX);
    const y = marginTop + row * (cardHeight + gapY);

    doc
      .roundedRect(x, y, cardWidth, cardHeight, 12)
      .lineWidth(1.2)
      .strokeColor('#E8591A')
      .stroke();

    doc
      .fontSize(11)
      .fillColor('#111111')
      .font('Helvetica-Bold')
      .text(restaurantName, x + 10, y + 12, { width: cardWidth - 20, align: 'center' });

    doc
      .fontSize(8.5)
      .fillColor('#555555')
      .font('Helvetica')
      .text(branch.name, x + 10, y + 27, { width: cardWidth - 20, align: 'center' });

    const qrUrl = buildTableQrUrl(branch.slug, table.qrToken);
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      width: 260,
      margin: 1,
    });

    const qrSize = Math.min(115, cardHeight - 95);
    const qrX = x + (cardWidth - qrSize) / 2;
    const qrY = y + 44;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fontSize(14)
      .fillColor('#E8591A')
      .font('Helvetica-Bold')
      .text(`Table ${table.name}`, x + 10, qrY + qrSize + 8, {
        width: cardWidth - 20,
        align: 'center',
      });

    doc
      .fontSize(9.5)
      .fillColor('#222222')
      .font('Helvetica')
      .text('Scan to order', x + 10, qrY + qrSize + 26, {
        width: cardWidth - 20,
        align: 'center',
      });
  }

  drawPageFooter();
  doc.end();
});
