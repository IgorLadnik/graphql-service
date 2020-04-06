import { buildSchema, GraphQLSchema, GraphQLResolveInfo } from "graphql";
const fs = require('fs');

export type ResolverFn = (parent: any, args: any, context: any, info: GraphQLResolveInfo) => any;

export interface ResolverMap {
    [fieldName: string]: ResolverFn;
}

export class GqlSchemaParser {
    readonly schema: GraphQLSchema;
    resolvers: ResolverMap = { };

    private readonly strSchema: string;

    constructor(str: string) {
        let strSchema = str;
        try {
            strSchema = fs.readFileSync(str, 'utf8');
        }
        catch { }

        this.strSchema = strSchema;
        try {
            this.schema = buildSchema(strSchema);
        }
        catch (err) {
            console.log(`ERROR in schema parsing: ${err}`);
        }
    }

    setResolvers(...arr: Array<{resolverName: string, fn: Function}>) {
        for (let i = 0;  i < arr.length; i++) {
            this.resolvers[arr[i].resolverName] = async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                try {
                    return await arr[i].fn(parent, args, context, info);
                }
                catch (err) {
                    console.log(`ERROR in resolver \"${arr[i].resolverName}\": ${err}`);
                    return null;
                }
            }
        }
    }
}
