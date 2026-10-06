# Irrigation Project Automation Platform: case study

## 1. Background

Professional irrigation documentation connects design outputs, material requirements, commercial catalogs and hydraulic decisions. This private desktop application brings several of those tasks into one local tool. This case study describes functionality verified in source; the separate demonstration uses invented data and a different interface.

## 2. Business problem

Material descriptions from engineering work do not always align with commercial product descriptions. Units and packaging also affect quantities. Preparing documents requires reconciliation, review and formatting, while customer information and project files need to remain accessible. These are the workflow problems addressed by the implementation, rather than quantified business outcomes.

## 3. Existing manual workflow

A representative workflow is to obtain a material spreadsheet from the design process, find corresponding catalog items, adjust quantities, identify unresolved components, prepare documentation and store it with customer files. Hydraulic requirements and pump information introduce another set of inputs. This is a reconstruction of the workflow from the application's responsibilities, not an independently measured historical process.

## 4. Requirements

The implementation supports local spreadsheet files, preserves identifiers, keeps unresolved materials reviewable, generates documents, associates files with customers and screens pump candidates against operating requirements. The portfolio adds a separate requirement: all examples must be synthetic and must disclose neither private implementation nor operational records.

## 5. Technical approach

Python supports data-processing and calculation services. PySide6 provides the desktop interface and signals. pandas reads spreadsheets, with openpyxl and xlrd supporting Excel formats. SQLite keeps the catalog and structured records local. Qt's text-document and printing APIs produce PDFs. The legacy Excel export uses openpyxl.

## 6. Architecture

UI modules call services for import, comparison, customer operations and hydraulics. A shared database layer persists records, and dataclasses carry results. Customer attachments remain files with database metadata. Long-running spreadsheet operations are delegated to Qt workers. This separates expensive processing from widget updates while retaining a local desktop deployment model.

## 7. File and data processing

Verified inputs are CSV, XLS and XLSX. Header normalization accommodates alternative column labels. Identifiers are read as text to preserve leading zeros. Row validation can report invalid records; comparison retains unresolved requests for review. The source does not establish a direct `.LND` parser, so no native design-file format is distributed or claimed here.

## 8. Material generation

The comparison service reconciles requests with catalog entries and handles domain-dependent quantity and component rules. The operator can edit or remove comparison items without necessarily changing the master catalog. Material variants must survive grouping when they are semantically different. Commercial mappings and company rules remain private.

The active comparison workflow exports PDF quotations and lists without prices. A saved-quotation Excel exporter exists with test coverage in the source, but its former UI tab is hidden. The public workbook demonstrates a neutral output format, not that hidden workflow or the company's template.

## 9. Hydraulic and pump sizing

Submersible selection accepts a required flow/head point or derives a requirement from well-system inputs, including pipe-loss calculations. Tabulated pump curves are interpolated only within their available flow range. Candidates that cannot meet the requested point are excluded. The interface can display technical curves and export a report.

Centrifugal selection uses a separate catalog group and currently accepts consolidated flow and total head. A service also implements more detailed head, power and available-NPSH calculations; this is distinguished from the currently exposed screen.

The public demo includes eight independently invented curves. It interpolates available head, rejects insufficient-head and out-of-range models, and ranks eligible models by head margin. Users can select another candidate, compare curves, download the fictional catalog, export SVG and print a report. At 6 m³/h and 55 m, Demo S60 supplies 60 m.

Component mode adds an explicitly simplified system curve: constant lift and pressure head plus supplied losses scaling with flow squared. The estimated intersection is distinguished from the requested point. Direct-head mode omits that estimate because total head alone does not define a system curve. All pump data and nominal powers are invented.

## 10. Customer and project information

Customer records can hold contact details and dossier metadata. Categorized attachments organize spreadsheets, project files and other documents. File content hashes help avoid duplicate copies within a customer/category. Quotations can reference customers while preserving legacy records. This is customer-centered document organization, not a verified standalone project-management system.

## 11. Error handling

Import services validate extensions, required columns and row values. UI handlers display failures. Comparison workers relay errors to the UI. Pump services reject several invalid input conditions and preserve limits of available performance data. Customer operations validate names, file categories and paths; some operations remove a just-created record or copy if a later step fails.

These are useful protections, but not evidence of comprehensive validation. More malformed-file, numerical-boundary and interruption tests would improve confidence. User-facing validation and service validation should be reviewed together.

## 12. Security and privacy

This is a local application with sensitive operational records. Local storage does not itself establish encryption, access control or safe redistribution. The portfolio excludes databases, attachments, exported business documents, branding and catalogs. Its demonstration has no connection to the application. Package provenance and release review are described in `SECURITY_AND_PRIVACY.md`.

## 13. Technical challenges

The most distinctive challenge is deciding when two material descriptions represent the same purchasable item. A visually similar string may refer to a different component or unit. Another challenge is preserving traceability when processing expands or groups rows. Keeping technical pump suitability separate from commercial availability prevents missing catalog data from being treated as a known price.

The desktop architecture also has practical consistency boundaries: worker-to-UI communication, file-copy failures and database updates. These are meaningful engineering concerns beyond constructing forms.

## 14. Results

The source demonstrates implemented workflows for spreadsheet processing, comparison, material documentation, customer dossiers and pump-related calculations. Those workflows automate steps that would otherwise require manual transformation or repeated entry. No benchmark, adoption count, revenue impact or percentage time saving was available for this case study. This review did not execute the private application or its test suite.

## 15. Future improvements

Priorities include separating configurable domain rules from processing code, adding synthetic fixture coverage for ambiguous inputs, documenting numerical assumptions, separating runtime data from distributed software, pinning build dependencies and adding CI for an independently publishable companion tool. These are proposals, not features already delivered in the private application.
