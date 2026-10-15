import type { Format } from '../../core/format';
import type { ReportText } from './text';
import type { RegisterBlock, RegisterData } from './types';

type Props = { register: RegisterData; text: ReportText; format: Format };

type GroupSpec = {
    id: number;
    label: keyof ReportText['register']['groups'];
    columns: (keyof ReportText['register']['columns'])[];
    numeric: number[];
    total: number;
};

const BLOCKS: Record<RegisterBlock, { colour: string; groups: GroupSpec[] }> = {
    wh: {
        colour: '#2E75B5',
        groups: [
            { id: 0, label: 'fabricIn', columns: ['colour', 'metres'], numeric: [1], total: 1 },
            { id: 1, label: 'accessoriesIn', columns: ['item', 'qty'], numeric: [1], total: 1 },
            { id: 2, label: 'fabricOut', columns: ['colour', 'metres'], numeric: [1], total: 1 },
            { id: 3, label: 'accessoriesOut', columns: ['item', 'qty'], numeric: [1], total: 1 },
        ],
    },
    cut: {
        colour: '#5FA02A',
        groups: [
            {
                id: 4,
                label: 'cut',
                columns: ['colour', 'metresUsed', 'style', 'size', 'pieces'],
                numeric: [1, 4],
                total: 4,
            },
        ],
    },
    prod: {
        colour: '#C55A11',
        groups: [
            {
                id: 5,
                label: 'received',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
                total: 3,
            },
            {
                id: 6,
                label: 'done',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
                total: 3,
            },
        ],
    },
    fin: {
        colour: '#8F3EC4',
        groups: [
            {
                id: 7,
                label: 'received',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
                total: 3,
            },
            {
                id: 8,
                label: 'done',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
                total: 3,
            },
        ],
    },
    stock: {
        colour: '#0070C0',
        groups: [
            {
                id: 9,
                label: 'packed',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
                total: 3,
            },
        ],
    },
};

/** The daily register: one band per day, one coloured block per department, rows by colour, style and size. */
export function RegisterView({ register, text, format }: Props) {
    const t = text.register;

    if (!register.days.length) return <div className="ui-empty">{t.empty}</div>;

    return (
        <div className="rg">
            <p className="rp-line">{t.intro}</p>
            {register.truncated && <div className="ui-notice">{t.truncated}</div>}
            {[...register.days].reverse().map((day) => (
                <article className="panel rg-day" key={day.date}>
                    <header>{format.date(day.date)}</header>
                    <div className="rg-blocks">
                        {register.sections.map((key) => {
                            const block = BLOCKS[key];

                            return (
                                <section
                                    className="rg-block"
                                    key={key}
                                    style={{ ['--rg' as string]: block.colour }}
                                >
                                    <h3>{t.sections[key]}</h3>
                                    <div className="rg-groups">
                                        {block.groups.map((group) => {
                                            const rows = day.groups[group.id] ?? [];
                                            const total = rows.reduce(
                                                (sum, row) => sum + Number(row[group.total] || 0),
                                                0,
                                            );

                                            return (
                                                <div className="rg-group" key={group.id}>
                                                    <h4>{t.groups[group.label]}</h4>
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                {group.columns.map(
                                                                    (column, index) => (
                                                                        <th
                                                                            key={column}
                                                                            className={
                                                                                group.numeric.includes(
                                                                                    index,
                                                                                )
                                                                                    ? 'num'
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {t.columns[column]}
                                                                        </th>
                                                                    ),
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.length ? (
                                                                rows.map((row, line) => (
                                                                    <tr key={line}>
                                                                        {group.columns.map(
                                                                            (column, index) => (
                                                                                <td
                                                                                    key={column}
                                                                                    className={
                                                                                        group.numeric.includes(
                                                                                            index,
                                                                                        )
                                                                                            ? 'num'
                                                                                            : ''
                                                                                    }
                                                                                >
                                                                                    {group.numeric.includes(
                                                                                        index,
                                                                                    )
                                                                                        ? format.number(
                                                                                              Number(
                                                                                                  row[
                                                                                                      index
                                                                                                  ],
                                                                                              ),
                                                                                          )
                                                                                        : String(
                                                                                              row[
                                                                                                  index
                                                                                              ] ??
                                                                                                  '',
                                                                                          ) ||
                                                                                          text.none}
                                                                                </td>
                                                                            ),
                                                                        )}
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td
                                                                        colSpan={
                                                                            group.columns.length
                                                                        }
                                                                        className="rg-empty"
                                                                    >
                                                                        {text.none}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                        {rows.length > 1 && (
                                                            <tfoot>
                                                                <tr>
                                                                    <td colSpan={group.total}>
                                                                        {t.total}
                                                                    </td>
                                                                    <td className="num">
                                                                        {format.number(total)}
                                                                    </td>
                                                                    {group.columns.length -
                                                                        group.total -
                                                                        1 >
                                                                        0 && (
                                                                        <td
                                                                            colSpan={
                                                                                group.columns
                                                                                    .length -
                                                                                group.total -
                                                                                1
                                                                            }
                                                                        />
                                                                    )}
                                                                </tr>
                                                            </tfoot>
                                                        )}
                                                    </table>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </article>
            ))}
        </div>
    );
}
