import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, TableSession } from '../models/index.js';

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  // Authenticate Staff JWT or Customer sessionToken on handshake
  ioInstance.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const headerAuth = socket.handshake.headers?.authorization;
      const bearerToken =
        headerAuth && headerAuth.startsWith('Bearer ') ? headerAuth.split(' ')[1] : null;

      const staffToken = auth.token || bearerToken;
      const sessionToken = auth.sessionToken || socket.handshake.headers?.['x-session-token'];

      if (staffToken) {
        const decoded = jwt.verify(staffToken, env.JWT_SECRET);
        if (decoded.type === 'CUSTOMER_SESSION') {
          const session = await TableSession.findById(decoded.sessionId);
          if (!session || session.status !== 'OPEN') {
            return next(new Error('Unauthorized: Session closed or invalid'));
          }
          socket.data.actorType = 'CUSTOMER';
          socket.data.sessionId = session._id.toString();
          socket.data.guestId = decoded.guestId;
          return next();
        }

        const user = await User.findById(decoded.sub);
        if (!user || !user.isActive) {
          return next(new Error('Unauthorized: Staff account inactive or missing'));
        }
        socket.data.actorType = 'STAFF';
        socket.data.userId = user._id.toString();
        socket.data.role = user.role;
        socket.data.branchId = user.branchId ? user.branchId.toString() : null;
        return next();
      }

      if (sessionToken) {
        const decoded = jwt.verify(sessionToken, env.JWT_SECRET);
        if (decoded.type !== 'CUSTOMER_SESSION' || !decoded.sessionId) {
          return next(new Error('Unauthorized: Invalid sessionToken'));
        }
        const session = await TableSession.findById(decoded.sessionId);
        if (!session || session.status !== 'OPEN') {
          return next(new Error('Unauthorized: Session closed or invalid'));
        }
        socket.data.actorType = 'CUSTOMER';
        socket.data.sessionId = session._id.toString();
        socket.data.guestId = decoded.guestId;
        return next();
      }

      return next(new Error('Unauthorized: Missing auth token or sessionToken'));
    } catch (err) {
      return next(new Error(`Unauthorized: ${err.message}`));
    }
  });

  ioInstance.on('connection', (socket) => {
    const { actorType, branchId, sessionId, role } = socket.data;

    if (actorType === 'STAFF' && branchId) {
      socket.join(`branch:${branchId}`);
      console.log(`🔌 Staff socket connected (${role}) -> joined branch:${branchId}`);
    } else if (actorType === 'CUSTOMER' && sessionId) {
      socket.join(`session:${sessionId}`);
      console.log(`🔌 Customer socket connected -> joined session:${sessionId}`);
    }

    // Optional manual room join with ownership verification
    socket.on('join:branch', (requestedBranchId) => {
      if (
        actorType === 'STAFF' &&
        requestedBranchId &&
        (role === 'superadmin' || String(requestedBranchId) === String(branchId))
      ) {
        socket.join(`branch:${requestedBranchId}`);
      }
    });

    socket.on('join:session', (requestedSessionId) => {
      if (
        (actorType === 'CUSTOMER' && String(requestedSessionId) === String(sessionId)) ||
        actorType === 'STAFF'
      ) {
        socket.join(`session:${requestedSessionId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const getIO = () => {
  return ioInstance;
};

export const emitToBranch = (branchId, event, payload) => {
  if (!ioInstance || !branchId) return;
  ioInstance.to(`branch:${String(branchId)}`).emit(event, payload);
};

export const emitToSession = (sessionId, event, payload) => {
  if (!ioInstance || !sessionId) return;
  ioInstance.to(`session:${String(sessionId)}`).emit(event, payload);
};
