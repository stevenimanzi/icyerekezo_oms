import React from 'react';

export function AdminTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? (
                        rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => (
                                    <td key={j}>{cell}</td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={headers.length} className="empty-cell">
                                No records yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
