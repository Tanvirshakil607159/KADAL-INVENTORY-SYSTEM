import React from 'react';

const PaginationBar = React.memo(({ currentPage, totalPages, totalItems, pageSize, onPageChange, position = 'bottom', loading = false }) => {
  if (loading || totalPages <= 1) return null;
  const isTop = position === 'top';
  const start = totalItems === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderTop: isTop ? undefined : '1px solid var(--border)',
      borderBottom: isTop ? '1px solid var(--border)' : undefined,
      marginTop: isTop ? 4 : 8,
      marginBottom: isTop ? 8 : 4
    }}>
      <div className="text-muted" style={{ fontSize: 12 }}>
        Showing {start}–{end} of {totalItems.toLocaleString()} records
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="btn btn-outline btn-sm"
          disabled={currentPage === 0}
          onClick={() => onPageChange(0)}
          style={{ padding: '4px 8px', fontSize: 12 }}
          title="First Page"
        >«</button>
        <button
          className="btn btn-outline btn-sm"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          style={{ padding: '4px 10px', fontSize: 12 }}
          title="Previous Page"
        >‹ PREV</button>
        <span style={{ padding: '0 10px', fontSize: 12, fontWeight: 600 }}>
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          className="btn btn-outline btn-sm"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          style={{ padding: '4px 10px', fontSize: 12 }}
          title="Next Page"
        >NEXT ›</button>
        <button
          className="btn btn-outline btn-sm"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          style={{ padding: '4px 8px', fontSize: 12 }}
          title="Last Page"
        >»</button>
      </div>
    </div>
  );
});

export default PaginationBar;
