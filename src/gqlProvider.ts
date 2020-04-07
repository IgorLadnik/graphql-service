const graphql = require('graphql');
const _ = require('lodash');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
    GraphQLInt,
    GraphQLList,
} = graphql;

export type Field = { name: string, properties: any };

export class GqlProvider {
    schema: any;
    config = new GraphQLObjectType({ name: 'Query' }).toConfig();

    addQueryFields(...arrArgs: Array<Field>) {
        for (let i = 0; i < arrArgs.length; i++) {
            let fieldDummy = new GraphQLObjectType({ name: '_', fields: { dummy: {} } }).toConfig().fields.dummy;
            let name = arrArgs[i].name;
            let properties = arrArgs[i].properties;
            let field = fieldDummy;
            field.type = properties.type;
            field.args = properties.args;
            field.resolve = properties.resolve;
            this.config.fields[name] = field;
        }

        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(this.config) });
        return this;
    }
}