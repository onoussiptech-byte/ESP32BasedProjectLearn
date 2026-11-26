"""Build src/references/index.json: every section a lesson may cite, with its exact PDF page.

The PDFs live in docs/. Sections come from the PDF bookmarks, or from MANUAL below for datasheets without bookmarks.
Every page number is checked against the text of the page: when the heading is really on the page before or after
(some bookmarks point one page too early), the number is corrected. A link to <pdf>#page=N then opens the right page.

Author's machine only:   pip install -r requirements-dev.txt    then    python src/tools/pdf_index.py
"""
import json
import re
import sys
from pathlib import Path

import pymupdf
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]          # ESP32BasedProjectLearn/
DOC_DIR = ROOT / "docs"
OUT = ROOT / "src" / "references" / "index.json"
pymupdf.TOOLS.mupdf_display_errors(False)

# key -> (file name, short title, official online URL or None)
DOCS = {
    "datasheet": ("esp32_datasheet_en.pdf", "ESP32 Series Datasheet",
                  "https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf"),
    "trm": ("esp32_technical_reference_manual_en.pdf", "ESP32 Technical Reference Manual",
            "https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf"),
    "idf": ("esp-idf-en-v5.3-esp32.pdf", "ESP-IDF Programming Guide v5.3 (ESP32)",
            "https://docs.espressif.com/projects/esp-idf/en/v5.3/esp32/esp-idf-en-v5.3-esp32.pdf"),
    "hwdesign": ("esp-hardware-design-guidelines-en-master-esp32.pdf", "ESP32 Hardware Design Guidelines", None),
    "ads1115": ("ads1115.pdf", "ADS1115 datasheet (Texas Instruments)", None),
    "ds18b20": ("DS18B20.pdf", "DS18B20 datasheet (Maxim)", None),
    "ph4502c": ("ph-sensor-ph-4502c.pdf", "PH-4502C probe and board guide", None),
    "dfrobotph": ("DFRobot_SEN0161-V2_pH_sensor.pdf", "DFRobot SEN0161-V2 pH sensor page", None),
    "fao_aquaponics": ("Small Scale aquaponic Systems  Guide.pdf", "Small-scale aquaponic food production (FAO, 2014)", None),
    "srac5007": ("principles-of-small-scale-aquaponics-srac-5007.pdf", "Principles of Small-Scale Aquaponics (SRAC-5007)", None),
    "yfs201": ("yf-s201_sea.pdf", "YF-S201 flow sensor datasheet", None),
    "floatswitch": ("FLS-VS-300_cutsheet.pdf", "FLS-VS-300 float switch cut sheet", None),
    "irlz44n": ("infineon-irlz44n-datasheet-en.pdf", "IRLZ44N MOSFET datasheet", None),
    "d1n5819": ("1n5817.pdf", "1N5817 to 1N5819 Schottky diode datasheet (Vishay)", None),
    "d1n4007": ("1n4001.pdf", "1N4001 to 1N4007 diode datasheet (Vishay)", None),
    "lm2596": ("lm2596.pdf", "LM2596 buck converter datasheet (Texas Instruments)", None),
    "lm317": ("lm317.pdf", "LM317 regulator datasheet (Texas Instruments)", None),
    "cjq4435": ("CJQ4435.pdf", "CJQ4435 P-channel MOSFET datasheet", None),
    "waterpump": ("Pump_Datasheet.pdf", "12 V water pump datasheet", None),
    "airpump": ("ZR370-02PM_4_4271538a963.pdf", "ZR370-02PM air pump specification", None),
    "dosingpump": ("Soldered_101844 mini water pump.pdf", "Mini water pump datasheet (Soldered 101844)", None),
    "resistor_sqp": ("YAGEO-SQP_NSP_DATASHEET.pdf", "SQP cement resistor datasheet (Yageo)", None),
    "resistor_cf": ("sei-cf_cfm.pdf", "CF carbon film resistor datasheet (Stackpole)", None),
    "dcjack": ("pj-102a.pdf", "PJ-102A DC power jack datasheet", None),
    "toggle": ("MTS-SMTS-Series.pdf", "MTS/SMTS toggle switch datasheet", None),
    "fuse": ("Littelfuse ATO.pdf", "ATO blade fuse datasheet (Littelfuse)", None),
}

# Documents without usable bookmarks: (section title shown to the learner, page, words that must be on that page).
# None = the page text cannot be extracted (checked by eye).
MANUAL = {
    "ds18b20": [("Description and features", 1, "FEATURES"), ("Pin configurations", 1, "PIN CONFIGURATIONS"),
                ("Pin description", 2, "PIN DESCRIPTION"), ("Overview", 2, "OVERVIEW"), ("Block diagram", 3, "Block Diagram"),
                ("Operation: measuring temperature", 3, "MEASURING TEMPERATURE"), ("Temperature register format", 4, "Temperature Register Format"),
                ("Operation: alarm signaling", 4, "ALARM SIGNALING"), ("Powering the DS18B20", 5, "POWERING THE DS18B20"),
                ("External supply wiring", 6, "External Supply"), ("64-bit lasered ROM code", 6, "64-BIT LASERED ROM CODE"),
                ("Memory", 7, "Memory Map"), ("Configuration register (resolution)", 8, "CONFIGURATION REGISTER"),
                ("CRC generation", 8, "CRC GENERATION"), ("1-Wire bus system", 9, "1-WIRE BUS SYSTEM"),
                ("Hardware configuration", 9, "HARDWARE CONFIGURATION"), ("Transaction sequence", 10, "TRANSACTION SEQUENCE"),
                ("ROM commands", 10, "ROM COMMANDS"), ("Function commands", 11, "FUNCTION COMMANDS"),
                ("1-Wire signaling", 15, "1-WIRE SIGNALING"), ("Read and write time slots", 15, "TIME SLOTS"),
                ("Operation example", 18, "OPERATION EXAMPLE 1"), ("Absolute maximum ratings", 19, "ABSOLUTE MAXIMUM RATINGS"),
                ("DC electrical characteristics", 19, "DC ELECTRICAL CHARACTERISTICS"), ("AC electrical characteristics", 20, "AC ELECTRICAL CHARACTERISTICS")],
    "ph4502c": [("What the pH board does", 1, "PH values range"), ("Board pinout", 2, "PH Probe Sensor Pinout"),
                ("Offset setting (2.5 V at pH 7)", 2, "Offset and how to use it"), ("Offset test sketch", 3, "Offset sketch"),
                ("pH limit setting", 4, "limit setting"), ("Connecting and calibrating the probe", 4, "Connecting and calibrating"),
                ("pH and temperature", 5, "different temperatures"), ("pH measurement sketch", 5, "PH measurement sketch"),
                ("Buffer solutions", 6, "buffer solutions")],
    "dfrobotph": [("Specification", 1, "Specification"), ("Pinout", 2, "Pinout"), ("FAQ", 2, "FAQ")],
    "fao_aquaponics": [("Introduction to aquaponics", 23, "Introduction to aquaponics"), ("1.3 Aquaponics", 26, "Aquaponics"), ("1.4 Applicability of aquaponics", 27, "Applicability of aquaponics"), ("2.1 Important biological components of aquaponics", 33, "Important biological components"), ("2.1.1 The nitrogen cycle", 33, "The nitrogen cycle"), ("2.2 The biofilter", 35, "The biofilter"), ("2.3 Maintaining a healthy bacterial colony", 36, "Maintaining a healthy bacterial colony"), ("2.4 Balancing the aquaponic ecosystem", 38, "Balancing the aquaponic ecosystem"), ("3.1 Tolerance range for each organism", 43, "tolerance range for each organism"), ("3.2 The five most important water quality parameters", 44, "five most important water quality parameters"), ("3.2.1 Oxygen", 44, "Oxygen"), ("3.2.2 pH", 45, "pH"), ("3.2.3 Temperature", 46, "Temperature"), ("3.2.4 Ammonia, nitrite, nitrate", 47, "nitrite"), ("3.5 Adjusting pH", 53, "pH"), ("3.6 Water testing", 54, "Water testing"), ("Design of aquaponic units", 57, "Design of aquaponic units"), ("4.1 Site selection", 60, "Site selection"), ("4.2 Essential components of an aquaponic unit", 64, "Essential components of an aquaponic unit"), ("4.2.1 Fish tank", 64, "Fish tank"), ("4.2.2 Filtration: mechanical and biological", 66, "Filtration"), ("4.2.3 Hydroponic components: media beds, NFT, DWC", 70, "Hydroponic components"), ("4.2.4 Water movement", 71, "Water movement"), ("4.2.5 Aeration", 73, "Aeration"), ("4.2.6 Sump tank", 74, "Sump tank"), ("4.2.7 Plumbing materials", 75, "Plumbing materials"), ("4.2.8 Water testing kits", 76, "Water testing kits"), ("4.3 The media bed technique", 76, "media bed technique"), ("4.4 Nutrient film technique (NFT)", 85, "Nutrient film technique"), ("4.5 Deep water culture technique", 89, "Deep water culture"), ("4.6 Comparing aquaponic techniques", 95, "Comparing aquaponic techniques"), ("5.4 System cycling and starting a biofilter colony", 101, "cycling"), ("Management and troubleshooting", 145, "Management and troubleshooting"), ("Appendix 6: key considerations before setting up a system", 221, "Key considerations"), ("Appendix 8: step-by-step construction of small systems", 231, "Step-by-step guide")],
    "srac5007": [("Introduction", 1, "Aquaponics is the integration"), ("System design and components", 1, "System Design and Components"), ("Greenhouse and lighting", 1, "Greenhouse/Lighting"), ("Fish unit", 2, "Fish Unit"), ("Plant unit: media beds, NFT, deep water culture", 2, "Plant Unit"), ("Solids removal", 3, "Solids Removal"), ("Biofiltration", 4, "Biofiltration"), ("Movement of water", 4, "Movement of Water"), ("Management: fish", 4, "Fish Management"), ("Management: plants", 5, "Plant Management"), ("Water quality", 6, "Water Quality"), ("Conclusion", 7, "Conclusion")],
    "yfs201": [("Description and features", 1, "Description"), ("Specifications", 1, "Specifications"), ("Flow and frequency table", 1, "Flow Range")],
    "floatswitch": [("Float switch description", 1, "float liquid level switch"), ("Technical specifications", 1, "Technical Specifications")],
    "irlz44n": [("Description and package", 1, None), ("Absolute maximum ratings", 1, None), ("Electrical characteristics", 2, None),
                ("Output and transfer curves", 3, None), ("Gate charge and safe operating area", 4, None), ("Switching time circuit", 5, None),
                ("Package outline", 8, None)],
    "d1n5819": [("Features and primary characteristics", 1, "PRIMARY CHARACTERISTICS"), ("Maximum ratings", 1, "MAXIMUM RATINGS"),
                ("Electrical characteristics", 1, "ELECTRICAL CHARACTERISTICS"), ("Ratings and characteristics curves", 2, "CURVES"),
                ("Package outline", 3, "PACKAGE OUTLINE")],
    "d1n4007": [("Features and primary characteristics", 1, "PRIMARY CHARACTERISTICS"), ("Maximum ratings", 1, "MAXIMUM RATINGS"),
                ("Electrical characteristics", 2, "ELECTRICAL CHARACTERISTICS"), ("Ratings and characteristics curves", 2, "CURVES"),
                ("Package outline", 4, "PACKAGE OUTLINE")],
    "cjq4435": [("Maximum ratings", 1, "Maximum ratings"), ("Electrical characteristics", 2, "Electrical characteristics"), ("Typical curves", 3, None)],
    "waterpump": [("Parameter specifications", 1, "Parameter specifications"), ("Technical requirement and dimensions", 1, "Technical requirement")],
    "airpump": [("Performance (voltage, current, flow)", 1, "Performance"), ("Reliability test", 1, "Reliability test"), ("Motor terminal and abnormal test", 2, "Motor terminal")],
    "dosingpump": [("Description and features", 1, "FEATURES"), ("Other views", 2, None)],
    "resistor_sqp": [("Ordering information and power rating", 2, "POWER RATING"), ("Dimensions and derating curve", 3, "DERATING CURVE"),
                     ("Temperature curve", 4, "TEMPERATURE CURVE"), ("Electrical characteristics", 5, "ELECTRICAL CHARACTERISTICS"),
                     ("Rated working voltage and marking", 7, "MARKING")],
    "resistor_cf": [("Features and electrical specifications", 1, "Electrical Specifications"), ("Mechanical specifications", 2, "Mechanical Specifications"),
                    ("Power derating curve", 3, "Power Derating Curve")],
    "dcjack": [("Features and specifications", 1, "SPECIFICATIONS"), ("Mechanical drawing", 2, "MECHANICAL DRAWING")],
    "toggle": [("SMTS series", 1, "SMTS Series"), ("MTS series: circuits and ratings", 4, "Circuitry trait"), ("MTS series: models (MTS-102 ON-ON)", 5, "MTS-102")],
    "fuse": [("Description and electrical characteristics", 1, "ATO"), ("Ratings and time-current curves", 1, "Time")],
}


def squash(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def walk(reader, items, depth, out):
    """Flatten the nested outline list into [{title, depth, page}]."""
    for it in items:
        if isinstance(it, list):                     # children of the previous item
            walk(reader, it, depth + 1, out)
            continue
        try:
            page = reader.get_destination_page_number(it) + 1
        except Exception:                            # broken bookmark: skip it
            continue
        out.append({"title": str(it.title).strip(), "depth": depth, "page": page})


def main():
    index, problems = {}, []
    for key, (name, title, url) in DOCS.items():
        path = DOC_DIR / name
        if not path.exists():
            sys.exit(f"missing: {path}")
        with pymupdf.open(path) as doc:
            cache = {}

            def text(n):
                if n not in cache:
                    cache[n] = squash(doc[n - 1].get_text()) if 1 <= n <= len(doc) else ""
                return cache[n]

            moved = missing = 0
            sections = []
            if key in MANUAL:
                for t, page, must in MANUAL[key]:
                    if must and squash(must) not in text(page):
                        problems.append(f"{key}: {must!r} is not on page {page}")
                    sections.append({"title": t, "depth": 0, "page": page, "manual": True})
            else:
                walk(PdfReader(str(path)), PdfReader(str(path)).outline, 0, sections)
                for s in sections:
                    full, bare = squash(s["title"]), squash(re.sub(r"^[\dIVX.]+\s+", "", s["title"]))
                    if not bare:
                        continue
                    order = (s["page"], s["page"] + 1, s["page"] - 1)
                    hit = next((p for w in (full, bare) for p in order if w in text(p)), None)
                    if hit is None:
                        missing += 1
                    elif hit != s["page"]:
                        s["page"] = hit
                        moved += 1
            index[key] = {"file": name, "title": title, "url": url, "pages": len(doc), "sections": sections}
            print(f"{key:13} {len(doc):5} pages  {len(sections):5} sections  {moved:3} page numbers corrected  {missing:3} not found in the text")
    if problems:
        sys.exit("\n".join(problems))
    OUT.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
