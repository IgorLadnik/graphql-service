const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
    GraphQLInt,
    GraphQLList,
} = graphql;
const _ = require('lodash');

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

export const User = new GraphQLObjectType({
    name: 'User',
    isTypeOf: GraphQLObjectType,
    fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        role: { type: GraphQLString }
    })
});

export const ChatMessage = new GraphQLObjectType({
    name: 'ChatMessage',
    isTypeOf: GraphQLObjectType,
    fields: () => ({
        id: { type: GraphQLID },
        content: { type: GraphQLString },
        time: { type: GraphQLString },
        author: { type: User },
    })
});

export const Chat = new GraphQLObjectType({
    name: 'Chat',
    isTypeOf: GraphQLObjectType,
    fields: () => ({
        id: { type: GraphQLID },
        participants: {
            type: new GraphQLList(User),
            resolve:
                (parent: any, args: any) => parent.participants
        },
        messages: {
            type: new GraphQLList(ChatMessage),
            resolve:
                (parent: any, args: any) => parent.messages
        }
    })
});
