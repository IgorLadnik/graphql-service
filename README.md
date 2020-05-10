## Problem

*graphQL* (referred below as *GQL*) schema has to be generated at runtime by ontology types on the start of service.

## What Does It Do?

This software may operate in two modes, namely,

- with a dynamically generated schema, and
- without a schema at all (schemaless mode). 

Currently, each mode requires a separate endpoint.

In the former mode GQL schema is generated at the start of service. 
In the latter mode this step is skipped. 
For GQL requests a schema stub is provided.
It is also possible to use the same processing procedure for an ordinary REST request providing 
GQL request as its payload.   

GQL infrastructure consists of main classes 
- **GqlProvider** (file *gqlProvider.ts*),
- **GqlRequestHandler**  (file *gqlRequestHandler.ts*), and 
- **GqlTypesCommon** (file *gqlTypesCommon.ts*).   

These classes are responsible for parsing incoming request and provide mechanism for execution of resolve functions.

File *types.ts* contains ontology types objects.

Class **GqlProvider** provides implementation of the **graphqlHTTP** hook functions
**rootValue**, **customExecuteFn**, **customValidateFn** and optionally **customParseFn**.


    setGqlOptions = (): graphqlHTTP.Options => {
        const options: graphqlHTTP.Options = {
            schema: this.schema,
            graphiql: true,
            customFormatErrorFn: (error: GraphQLError) => this.formatErrorFn(error)
        };

        if (this.withSchema)
            options.rootValue = this.resolvers;
        else {
            options.customExecuteFn = async (args: ExecutionArgs): Promise<any> =>
                await this.executeFn(args.document.definitions[0]);

            options.customValidateFn =
                (schema, documentAST, validationRules): any =>
                    this.validateFn(schema, documentAST, validationRules);
        }

        return options;
    }
		
Registered resolved field provides full field path, and the field resolve function.
The resolve function may be defined implicitly in registered **resolveFns** based on naming convention. 
In addition, topmost field should provide its output type as a dummy object of appropriate type 
(please see file *types.ts*).
E.g., object **User** represents type **ClassUser**.
When field output type is array, then **type** property is assigned to an array with the appropriate type dummy object 
as the array first member, e.g., array **[Chat]** for type **Array&lt;ClassChat&gt;**.      

## Request Processing

Web server should be able to process several requests simultaneously.
The processing requires usage of state properties, particularly to reduce number of arguments of recursive functions.
To ensure parallel requests handling, class method **executeFn** of class **GqlProvider** creates a separate instance
of class **GqlRequestHandler** for each request.
Instance of class **GqlRequestHandler** holds state required for processing of a single request.    
	
## Parsing of Request Object

Usage of the above hooks implies custom parsing of GQL queries.

Parsing of request objects is carried out in two steps.
First, received string is parsed with standard **parse()** function from *graphql/language/parser*.
This function is embed in static method **parseFn()** of **GqlProvider** class.   

Then recursive method **makeTypedFieldsTree()** of class **GqlRequestHandlerr** converts result of previous parsing
to a **typesFieldsTree** hierarchy.
This tree is independent on actual data retrieving mechanism.
It provides types for actual fields and defines order of data access functions calls.
The method also validates query format and logs errors, if any.
Parsing result is logged (by default to console).

## Dealing with Actual Data

Another recursive method **execute()** of class **GqlRequestHandler** activates resolve functions.

Objects **contextConst** and **contextVar** are used for data exchange between resolve functions and with
**GqlRequestHandler** object.
**contextConst** is defined in class **GqlProvider** and is common for all instances of **GqlRequestHandler** class.
It contains permanent objects, like connection to database, whereas
**contextVar** is specific for each instance of **GqlRequestHandler** class and holds varying objects 
like interim fetches results. 

## Processing of Received String

So far we have discussed a *GQL* Web server that uses function **graphqlHTTP** for routing.
This implies usage of schema stub despite schema is not actually needed. 
However, it is possible to use the same infrastructure for an ordinary *REST* Web server with schemaless GQL.
This is illustrated at the end of file *app.ts* with the following code:

    const output = await gqlProvider.processSource(src);
    
where *src* is received string request. 
*output* may be returned to a client as a response to a REST request. 

Code fragment with **server2** demonstrates REST server processing GQL query received as plain text:

    server2.post('/', async (req: any, res: any) => {
        let output = 'No result';
        if (req.headers['content-type'] === 'text/plain')
            output = await gqlProvider.processSource(req.body);

        res.send(output);
    });

## Notes

One build error takes place for unknown reason:
    
    error TS2749: 'StringDecoder' refers to a value, but is being used as a type here.
    138         decoder: StringDecoder | null;

It does not affect code execution.

By default, code runs with test "cached" data.
It may use a local SQL Server in stead (to switch we have to install environment system variable 
**GqlSchemalessServiceStorage** and set its value to *SqlServer*).

- Simple requests tested so far.
- "Naive" handling of SQL Server with direct SQL queries without any ORM.

## Discussion

This PoC project 

- automatically generates GQL schema out of ontology types at the start of service,
- supports schemaless GQL Web server with requests both as GQL and plain text,
- provides uniform infrastructure for preparation of types hierarchy tree and activation of resolve functions,
- illustrates resolve functions for test cached data and SQL Server storage.

As an alternative to SQL Server, non-relational database may be considered.

IMHO it would be useful to incorporate this project into a more general *Processor-Commands* infrastructure 
published here: https://github.com/IgorLadnik/NodeProcessorCommands .
