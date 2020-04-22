# Problem

The task stated (as I understood it) in ideal form was as following:
Create Web server that will be able to accept and process any (meaning without providing schema upfront) graphQL (referred below as GQL) queries. 

# What Does It Do?

This sample demonstrates an approach to "schemaless" graphQL.
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
				resolveFunc: async (field, args, contextConst, contextVar) => {
					TypesCommon.updateFieldTypeFilter(field, contextVar);
					const queryArgs = TypesCommon.getQueryArgs(field);
					const query = `SELECT ${queryArgs} FROM Users WHERE id = ${args.id}`;
					await typesCommon.resolveFunc01(gqlProvider, field, query, args, contextConst, contextVar);
				}
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

