# Synthetic fixture

`project.json` is an invented JSON fixture created for this portfolio. Its field names are not an application interchange format. It contains three sectors and eight material rows. It is not a CalcLANDSCAPE export or a `.LND` file.

The separate demo embeds an identical fixture so that it can open directly from disk without a server. It parses and validates that JSON in browser memory. Exact identifier/unit pairs are grouped, with conflicting descriptions rejected. Quantities must be finite and positive, and count units must be whole numbers.

Expected output: `DEMO-SPRAY` = 12 each, `DEMO-DRIP` = 90 m, `DEMO-VALVE` = 3 each, `DEMO-PIPE` = 135 m. Lengths of different materials must not be treated as interchangeable, and count and length quantities must not be summed together.

`materials-example.csv` contains that grouped snapshot. `materials-example.xlsx` contains one formatted worksheet of the same quantities. Both were created independently for this case study. Neither includes commercial prices, company formatting or a production export.

The supplied duty point is 6 m³/h. Head is illustrated as 20 m lift + 30 m pressure head + 5 m assumed losses = 55 m. Losses are an input, not the result of a friction equation. Sector flows are not inferred from material counts.

`demo/pump-catalog.js` contains eight independently invented models and Q-H tables. Download the same data as JSON from Pump. Nominal kW values are fictional metadata. Demo S60 supplies 60 m at 6 m³/h. Additional presets cover 12 m³/h at 35 m, 4 m³/h at 110 m, and a no-match case at 20 m³/h and 150 m.

Interpolation is limited to each tabulated range. Component mode illustrates H(Q) = lift + pressure head + losses × (Q / required flow)². Its estimated intersection is separate from the requested point. Direct-head mode does not infer an intersection. SVG and print outputs use the current validated calculation.

The project fixture and invented pump catalog are the only data sources. No real customer or manufacturer data was sampled to create them.
