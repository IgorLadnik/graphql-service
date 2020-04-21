# What Does It Do?

This sample shows some approach to "schemaless" graphQL.
It is a Web server.
It 
- receives graphQL queries,
- parses it to a hierarchy tree (output to console by default), and
- executes some selected queries with simple SQL Server database with an attempt to generalize resolve functions.

<p>
Class GqlProvider (file <i>gqlProvider.ts</i>) is responsible for parsing query.
It and class TypesCommon (file <i>typesCommon.ts</i>) provide mechanism for execution of resolve functions.
File <i>types.ts</i> contains types objects.
</p>

# Notes

- Simple queries tested so far. No mutations yet.
- "Naive" database operations with direct SQL queries without any ORM or caching.

# Issues

- N+1 queries problem meaning multiple data fetching on each query level 
- Full generalization of resolve functions looks problematic
