# FM OData client

![CI Workflow](https://github.com/github/soliantconsulting/fm-odata-client/workflows/ci.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/soliantconsulting/fm-odata-client/badge.svg?branch=main)](https://coveralls.io/github/soliantconsulting/fm-odata-client?branch=main)

## Filters

Filters in OData are simple string expressions. If you just want to write them yourself, you can find more information
about the syntax in the [OData docs](http://docs.oasis-open.org/odata/odata/v4.0/errata03/os/complete/part1-protocol/odata-v4.0-errata03-os-part1-protocol-complete.html#_The_$filter_System).

Alternatively, you can use a filter builder like [odata-filter-builder](https://www.npmjs.com/package/odata-filter-builder)
to programmatically create queries. 

Please note the following FileMaker specifics:

- The following built-in functions are not supported:
    - `indexof()`
    - `isof()`
    - `geo.distance()`
    - `geo.length()`
    - `geo.intersects()`
- Date, time, and timestamp formats conform to ISO 8601. Time zone offsets are relative to the time zone of the server.
- Enclose field names that include special characters, such as spaces or underscores, in double-quotation marks.
