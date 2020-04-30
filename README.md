# Problem

The task stated (as I understood it) in ideal form was as following:
Create Web server that will be able to accept and process any 
(meaning without providing schema upfront) *graphQL* (referred below as *GQL*) queries. 

# What Does It Do?

This code demonstrates an approach to a "schemaless" GQL.

Normally, usage of GQL implies submission of GQL schema before start of the server.
Such a schema is fixed and cannot be changed while the server is running.
The schema restricts inbound queries.

The main goal of the project is to make GQL Web server as flexible as possible.
To achieve this, first we need to allow any formally valid GQL query.
So, in contrast to normal GQL usage, the project does not use GQL schema 
(to be precise, a meaningless schema stub is used to satisfy **graphqlHTTP** GQL infrastructure object)
and therefore is open to any inbound GQL query.
This is attained with implementation of hook methods of **graphqlHTTP** object (please see details below).
These methods block usage of the schema, but at the same time deny standard way for parsing and resolve functions call.
So, custom mechanism for parsing and call of resolve functions is implemented.
Second, attempt is made to provide some general resolve functions or at least boilerplate for them.

Schemaless approach gives developer more freedom to define data types.
It is assumed that the server receives those types on its start before starting to listen for queries 
(actually type may be submitted at runtime as well, before it's usage in a query).

It is a Web server which
- receives GQL queries,
- parses it to a hierarchy tree (called in the code **actionTree** and output to console by default), and
- executes some selected queries to a simple SQL Server database with an attempt to generalize resolve functions.

GQL infrastructure consists of classes **GqlProvider** (file *gqlProvider.ts*) and **TypesCommon** (file *typesCommon.ts*).   
Class **GqlProvider** is responsible for parsing query and along with class **TypesCommon** 
provides mechanism for execution of resolve functions.

File *types.ts* contains types objects.

## Go Schemaless

In order to be able to process any query hook functions of **graphqlHTTP** are intercepted:  
 
	app.use('/graphql', graphqlHTTP({
	  schema: gqlProvider.schema, // schema stub
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
            type: User, // required for topmost fields only
            resolveFunc: async (field, args, contextConst, contextVar) =>
                await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                  resolveFns.query_user)
        },

        {
            fullFieldPath: 'personChats',
            type: [Chat], // required for topmost fields only
            resolveFunc: async (field, args, contextConst, contextVar) =>
                await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                  resolveFns.query_personChats)
        },
        {
            fullFieldPath: 'personChats.participants',
            resolveFunc: async (field, args, contextConst, contextVar) =>
                await gqlTypesCommon.resolveQuery(field, args, contextConst, contextVar,
                                                  resolveFns.query_personChats_participants)
        },
        {
          //.....
        },
        
        {
            fullFieldPath: 'addMessage',
            type: ChatMessage, // required for topmost fields only
            resolveFunc: async (field, args, contextConst, contextVar) =>
                await gqlTypesCommon.resolveMutation(field, args, contextConst, contextVar,
                                                     resolveFns.mutation_dummy)
        },       
      );
		
In registered resolved field provides full path to the field and the field resolve function.
In addition, topmost field should provide its output type as an dummy object of appropriate type (please see file *types.ts*).
E.g., object **User** represents type **ClassUser**.
When field output type is array, then *type* property is assigned to an array with the appropriate type dummy object 
as the array first member, e.g., array **[Chat]** for type **Array&lt;ClassChat&gt;**.      
	
## Query Parsing

Usage of the above hooks implies custom parsing of GQL queries.
Recursive method **parse()** of class **GqlProvider** parses an inbound query and produces **actionTree** hierarchy.
This tree independent on actual data retrieving mechanism.
It defines order of data functions calls.
The method also validates query format and logs errors, if any.
Parsing result is logged (by default to console).

## Dealing with Actual Data

Another recursive method **executeActionTree()** of class **GqlProvider** activates resolve functions.

Objects **contextConst** and **contextVar** are used for data exchange between resolve functions and with
**GqlProvider** object.
**contextConst** contains permanent objects, like connection to database, whereas
**contextVar** holds varying objects like previous fetches results. 

# Notes

One build error takes place for unknown reason:
    
    error TS2749: 'StringDecoder' refers to a value, but is being used as a type here.
    138         decoder: StringDecoder | null;

It does not affect code execution.

By default, code runs with "cached" data.
It may use a local database in stead (to switch we have to change in file *app.ts* value of **isTestObjects** to *false*).

- Simple requests tested so far.
- "Naive" handling of SQL Server with direct SQL queries without any ORM.

# Issues

There two main issues, namely,

- N+1 queries problem in server side meaning multiple data fetching on a single GQL query, and
- In case of relational database, a complete generalization of resolve functions may not be possible.

Both are fundamental problems of GQL. 

On the first problem, for relational database reduction in number of database queries may be achieved with 
a "broader" SQL query with inner joining followed by in-memory separating of its result. 
This approach is illustrated in the code.

The second one may be addressed with some classification of queries.

As an alternative, *non-relational database may be considered*.

