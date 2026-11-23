export default function KotPrintSheet({ order, restaurantName, branchName, station = 'ALL' }) {
  if (!order) return null;

  const visibleItems =
    station === 'ALL'
      ? order.items || []
      : (order.items || []).filter((item) => item.station === station);

  return (
    <div id="kot-print-sheet" className="hidden print:block text-black bg-white">
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <p className="font-bold text-sm uppercase">{restaurantName || 'Aapka Waiter'}</p>
        {branchName && <p className="text-xs">{branchName}</p>}
        <p className="font-bold text-base mt-1">*** KITCHEN ORDER TICKET ***</p>
      </div>

      <div className="flex justify-between text-xs font-bold mb-1">
        <span>ORDER: {order.orderNo}</span>
        <span>TABLE: {order.tableId?.name || 'N/A'}</span>
      </div>
      <div className="flex justify-between text-[11px] border-b border-dashed border-black pb-2 mb-2">
        <span>STATION: {station}</span>
        <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className="space-y-2 border-b border-dashed border-black pb-2 mb-2">
        {visibleItems.map((item) => (
          <div key={item._id} className="text-xs">
            <div className="flex justify-between font-bold">
              <span>
                {item.qty} x {item.name}
              </span>
              <span>[{item.station}]</span>
            </div>
            {item.variant?.name && <div className="pl-3 text-[11px]">- Size: {item.variant.name}</div>}
            {item.addons?.length > 0 && (
              <div className="pl-3 text-[11px]">
                - Add-ons: {item.addons.map((a) => a.name).join(', ')}
              </div>
            )}
            {item.note && <div className="pl-3 font-bold text-[11px]">* NOTE: {item.note}</div>}
          </div>
        ))}
      </div>

      <div className="text-center text-[10px] pt-1">
        <p>Printed at {new Date().toLocaleTimeString()}</p>
        <p className="mt-1 font-bold">Designed &amp; Developed by HeryxStudio</p>
      </div>
    </div>
  );
}
