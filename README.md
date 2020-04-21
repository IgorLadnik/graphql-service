# What Does It Do?

This sample shows some approach to "schemaless" graphQL.
It is a Web server.
It 
- receives graphQL queries,
- parses it to a hierarchy tree (output to console by default), and
- executes some selected queries with simple SQL Server database with an attempt to generalize resolve functions.

Class **GqlProvider** (file *gqlProvider.ts*) is responsible for parsing query.
It and class **TypesCommon** (file *typesCommon.ts*) provide mechanism for execution of resolve functions.
File *types.ts* contains types objects.

## Go Schemaless

In order to be able to process any query hook functions of **graphqlHTTP** were intercepted:  
> 
> app.use('/graphql', graphqlHTTP({
>     schema: gqlProvider.schema,
>     graphiql: true,
> 
>     customExecuteFn: async (args: ExecutionArgs): Promise<any> =>
>         await gqlProvider.executeFn(args.document.definitions[0]),
> 
>     customValidateFn: (schema, documentAST, validationRules): any =>
>         gqlProvider.validateFn(schema, documentAST, validationRules),
> 
>     customFormatErrorFn: (error: GraphQLError) =>
>         gqlProvider.formatErrorFn(error),
> })); 
> 

# Notes

- Simple queries tested so far. No mutations yet.
- "Naive" database operations with direct SQL queries without any ORM or caching.

# Issues

- N+1 queries problem meaning multiple data fetching on each query level 
- Full generalization of resolve functions looks problematic
