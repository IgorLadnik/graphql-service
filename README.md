# Problem

The task stated (as I understood it) in ideal form was as following:
Create Web server that will be able to accept and process any (meaning without provideing schema upfront) graphQL (referred below as GQL) queries. 

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
	
Class **GqlProvider** performs main job.
First, its instance is created  
	
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
		
In registered resolved field the same type is also provided for the case of array of this type.
E.g., type User should be assigned in both cases when resolve function returns either User or User[]. 
		
## Query Parsing

Usage of the above hooks implies custom parsing of GQL queries.
Recursive method **parse()** of class **GqlProvider** parses inbound query and produces hierarchy tree (called in code **actionTree**).
This tree independent on actual data.
It defines order of actual data functions calls.
The method also performs query format validation and logs errors, if any.
Parsing result is logged (by default to console).

## Dealing with Actual Data

Another recursive method **executeActionTree()** of class **GqlProvider** activates resolve functions.

# Notes

One build error takes place for unknown reason:
 error TS2749: 'StringDecoder' refers to a value, but is being used as a type here.

138         decoder: StringDecoder | null;

It does not affect code execution.

Currently, by default the code runs without execution of resolve functions which require a local database.

- Simple queries tested so far. No mutations yet.
- "Naive" database operations with direct SQL queries without any ORM or caching.

# Issues

- N+1 queries problem meaning multiple data fetching on each query level, and
- Full generalization of resolve functions looks problematic.

Both are fundamental problems. 
The first problem may be alleviated with some caching (possibly with using some ORM).
The second one may be addressed with some classification of queries.

