import type { Format } from '../../core/format';
import type { ReportText } from './text';
import type { RegisterBlock, RegisterData } from './types';

type Props = { register: RegisterData; text: ReportText; format: Format };

type Columns = keyof ReportText['register']['columns'];
type GroupSpec = {
    source: number | 'quality' | 'sales' | 'cut_damaged' | 'sew_damaged';
    label: keyof ReportText['register']['groups'];
    columns: Columns[];
    numeric: number[];
    money?: number[];
};

const BLOCKS: Record<RegisterBlock, { colour: string; groups: GroupSpec[] }> = {
    wh: {
        colour: '#2E75B5',
        groups: [
            { source: 0, label: 'fabricIn', columns: ['colour', 'metres'], numeric: [1] },
            { source: 1, label: 'accessoriesIn', columns: ['item', 'qty'], numeric: [1] },
            { source: 2, label: 'fabricOut', columns: ['colour', 'metres'], numeric: [1] },
            { source: 3, label: 'accessoriesOut', columns: ['item', 'qty'], numeric: [1] },
        ],
    },
    cut: {
        colour: '#5FA02A',
        groups: [
            {
                source: 4,
                label: 'cut',
                columns: ['colour', 'metresUsed', 'style', 'size', 'pieces'],
                numeric: [1, 4],
            },
            {
                source: 'cut_damaged',
                label: 'damaged',
                columns: ['colour', 'style', 'size', 'damagedPieces', 'fabricLost'],
                numeric: [3, 4],
            },
        ],
    },
    prod: {
        colour: '#C55A11',
        groups: [
            {
                source: 5,
                label: 'received',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
            },
            { source: 6, label: 'done', columns: ['colour', 'style', 'size', 'qty'], numeric: [3] },
            {
                source: 'sew_damaged',
                label: 'damaged',
                columns: ['colour', 'style', 'size', 'damagedPieces'],
                numeric: [3],
            },
        ],
    },
    fin: {
        colour: '#8F3EC4',
        groups: [
            {
                source: 7,
                label: 'received',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
            },
            { source: 8, label: 'done', columns: ['colour', 'style', 'size', 'qty'], numeric: [3] },
        ],
    },
    stock: {
        colour: '#0070C0',
        groups: [
            {
                source: 9,
                label: 'packed',
                columns: ['colour', 'style', 'size', 'qty'],
                numeric: [3],
            },
        ],
    },
    quality: {
        colour: '#C0392B',
        groups: [
            {
                source: 'quality',
                label: 'checks',
                columns: ['colour', 'style', 'size', 'stage', 'checked', 'passed', 'rejected'],
                numeric: [4, 5, 6],
            },
        ],
    },
    sales: {
        colour: '#1E8E5A',
        groups: [
            {
                source: 'sales',
                label: 'sold',
                columns: ['item', 'qty', 'value'],
                numeric: [1, 2],
                money: [2],
            },
        ],
    },
};

/** The daily register: one band per day, one coloured block per department, rows by colour, style and size. */
export function RegisterView({ register, text, format }: Props) {
    const t = text.register;

    if (!register.days.length) return <div className="ui-empty">{t.empty}</div>;

    const cell = (
        column: Columns,
        group: GroupSpec,
        index: number,
        value: string | number | undefined,
    ) => {
        if (group.numeric.includes(index)) {
            return group.money?.includes(index)
                ? format.money(Number(value))
                : format.number(Number(value));
        }
        if (column === 'stage')
            return (
                text.departments[String(value) as keyof typeof text.departments] ??
                String(value ?? '')
            );

        return String(value ?? '') || text.none;
    };

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
                                            const rows =
                                                (typeof group.source === 'number'
                                                    ? day.groups[group.source]
                                                    : day[group.source]) ?? [];

                                            return (
                                                <div
                                                    className="rg-group"
                                                    key={String(group.source)}
                                                >
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
                                                                                    {cell(
                                                                                        column,
                                                                                        group,
                                                                                        index,
                                                                                        row[index],
                                                                                    )}
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
                                                                                {index === 0
                                                                                    ? t.total
                                                                                    : group.numeric.includes(
                                                                                            index,
                                                                                        )
                                                                                      ? cell(
                                                                                            column,
                                                                                            group,
                                                                                            index,
                                                                                            rows.reduce(
                                                                                                (
                                                                                                    sum,
                                                                                                    row,
                                                                                                ) =>
                                                                                                    sum +
                                                                                                    Number(
                                                                                                        row[
                                                                                                            index
                                                                                                        ] ||
                                                                                                            0,
                                                                                                    ),
                                                                                                0,
                                                                                            ),
                                                                                        )
                                                                                      : ''}
                                                                            </td>
                                                                        ),
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
