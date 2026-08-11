import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

path = Path(r"C:\Users\Steven IMANZI\Downloads\UNIFORM ORDER QUANTITIES PHASE 2.xlsx")
ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
rels_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

with zipfile.ZipFile(path) as archive:
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = ["".join(n.text or "" for n in item.iter() if n.tag.endswith("}t")) for item in root.findall("m:si", ns)]
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    relmap = {node.attrib["Id"]: node.attrib["Target"] for node in rels}
    print("SHEETS:", [sheet.attrib["name"] for sheet in workbook.find("m:sheets", ns)])
    for sheet in workbook.find("m:sheets", ns):
        name = sheet.attrib["name"]
        target = relmap[sheet.attrib[f"{{{rels_ns}}}id"]].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        root = ET.fromstring(archive.read(target))
        dimension = root.find("m:dimension", ns)
        print(f"\n=== {name} ({dimension.attrib.get('ref') if dimension is not None else ''}) ===")
        merges = root.find("m:mergeCells", ns)
        if merges is not None:
            print("MERGES:", ", ".join(x.attrib["ref"] for x in merges[:80]))
        nonempty = []
        for row in root.findall(".//m:sheetData/m:row", ns):
            cells = []
            for cell in row.findall("m:c", ns):
                value_node = cell.find("m:v", ns)
                inline = cell.find("m:is", ns)
                formula = cell.find("m:f", ns)
                value = ""
                if inline is not None:
                    value = "".join(n.text or "" for n in inline.iter() if n.tag.endswith("}t"))
                elif value_node is not None:
                    value = value_node.text or ""
                    if cell.attrib.get("t") == "s" and value:
                        value = shared[int(value)]
                if value or formula is not None:
                    entry = f"{cell.attrib['r']}={value!r}"
                    if formula is not None:
                        entry += f" [={formula.text}]"
                    cells.append(entry)
            if cells:
                nonempty.append(" | ".join(cells))
        print("\n".join(nonempty[:120]))
        if len(nonempty) > 120:
            print(f"... {len(nonempty)-120} more non-empty rows")
    print("\nMEDIA:", [x for x in archive.namelist() if x.startswith("xl/media/")])
