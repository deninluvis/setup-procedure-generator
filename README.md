# Setup Procedure Generator

Browser-based tool for writing work setup procedures, per product (grouped by line) and per machine.

- Photos of the product/machine and packaging or control panel
- Step-by-step guides, each with an optional headline and photo
- Clean black-and-white PDF with Prepared by / Approved by sign-off and a blank staffing and time table
- Data is stored in the browser (localStorage); export and import a JSON backup

## Run

Open `index.html` in a browser. No build step. The PDF uses jsPDF loaded from a CDN.

Note: `index.html` was built as a Claude artifact. The PDF save uses the artifact `downloads` capability and falls back to a normal browser download elsewhere.
