# Problem

The task stated (as I understood it) in ideal form was as following:
Create Web server that will be able to accept and process any (meaning without providing schema upfront) graphQL (referred below as GQL) queries. 

# What Does It Do?

This sample demonstrates an approach to "schemaless" graphQL.

Normally, usage of GQL implies submission of GQL schema before start of the server.
This schema is fixed and cannot be changed while the server is running.
The schema restricts inbound queries.

The main goal of the project is to make GQL Web server as flexible as possible.
To achieve this, first we need to open the server to any formally valid GQL query.
So, in contrast to normal GQL usage, the project does not use GQL schema and therefore is open to any inbound GQL query.
To achieve this hook, methods of **graphqlHTTP** object are implemented (please see details below).
These methods block usage of the schema, but at the same time deny standard way for parsing and resolve functions call.
So, custom mechanism for parsing and call of resolve function is implemented.
Second, attempt is made to provide some general resolve functions or at least boilerplate for them (this work is still in progress).

Schemaless approach gives developer more freedom to define data types.
It is assumed that the server will receive those types on its start before starting to listen for queries 
(actually type may be submitted at runtime as well, before it's usage in a query).

It is a Web server which
- receives GQL queries,
- parses it to a hierarchy tree (called in the code **actionTree** and output to console by default), and
- executes some selected queries with simple SQL Server database with an attempt to generalize resolve functions.

GQL infrastructure consists of classes **GqlProvider** (file *gqlProvider.ts*) and **GqlProvider** (file *gqlProvider.ts*).   
Class **GqlProvider** is responsible for parsing query and along with class **TypesCommon** 
provides mechanism for execution of resolve functions.

File *types.ts* contains types objects.

## Go Schemaless

In order to be able to process any query hook functions of **graphqlHTTP** are intercepted:  
 
	app.use('/graphql', graphqlHTTP({
	 schema: gqlProvider.schema,
	 graphiql: true,

	 customExecuteFn: async (args: ExecutionArgs): Promise<any> =>
		 await gqlProvider.executeFn(args.document.definitions[0]),

	 customValidateFn: (schema, documentAST, validationRules): any =>
		 gqlProvider.validateFn(schema, documentAST, validationRules),

	 customFormatErrorFn: (error: GraphQLError) =>
		 gqlProvider.formatErrorFn(error),
	})); 
	
Class **GqlProvider** performs the main job.
First, its instance is created:
	
	const gqlProvider = new GqlProvider(logger);

Then type objects of domain entities (file *types.ts*) and resolve functions should be registered with this object:

	gqlProvider
      .registerTypes(User, ChatMessage, Chat)
      .registerResolvedFields(
		{
		  fullFieldPath: 'user',
		  type: User,
		  resolveFunc: async (field, args, contextConst, contextVar) =>
                            await typesCommon.resolveFunc01(
                               gqlProvider, 
                               field, 
                               args, 
                               contextConst, 
                               contextVar,
                               resolveFns.fetchData_user)
		},
		{
		  //.....
		}
	  );
		
In registered resolved field the same type is also provided for the case when the function produces array of this type.
E.g., type **User** should be assigned in both cases when resolve function produces either **User** or **User[]**. 
		
## Query Parsing

Usage of the above hooks implies custom parsing of GQL queries.
Recursive method **parse()** of class **GqlProvider** parses an inbound query and produces **actionTree** hierarchy.
This tree independent on actual data retrieving mechanism.
It defines order of data functions calls.
The method also validates query format and logs errors, if any.
Parsing result is logged (by default to console).

## Dealing with Actual Data

Another recursive method **executeActionTree()** of class **GqlProvider** activates resolve functions.

Objects **contextConst** and **contextVar** are used for data exchange between resolve functions and sometimes with 
**GqlProvider** object.
**contextConst** contains permanent objects, like connection to database, whereas
**contextVar** holds varying objects like previous fetchings and result object. 

# Notes

One build error takes place for unknown reason:
    
    error TS2749: 'StringDecoder' refers to a value, but is being used as a type here.
    138         decoder: StringDecoder | null;

It does not affect code execution.

By default, code runs with "cached" data.
It may use a local database in stead (to switch we have to change in file *app.ts* value of **isTestObjects** to *false*).
Currently, by default the code runs without execution of resolve functions which require a local database.

- Simple queries tested so far. No mutations yet.
- For SQL Server "naive" approach is implemented with direct SQL queries without any ORM or caching.

# Issues

- N+1 queries problem meaning separate multiple data fetching on each query level, and
- In case or relational database full generalization of resolve functions looks problematic.

Both are fundamental problems. 
The first problem may be alleviated with some caching (possibly with using some ORM).
The second one may be addressed with some classification of queries.

As an alternative, *non-relational database may be considered*.

