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

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

export const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        role: { type: GraphQLString }
    })
});

export const ChatMessage = new GraphQLObjectType({
    name: 'ChatMessage',
    fields: () => ({
        id: { type: GraphQLID },
        content: { type: GraphQLString },
        time: { type: GraphQLString },
        author: { type: User },
    })
});

export const Chat = new GraphQLObjectType({
    name: 'Chat',
    fields: () => ({
        id: { type: GraphQLID },
        participants: {
            type: new GraphQLList(User),
            resolve: (parent: any, args: any) => parent.participants
        },
        messages: {
            type: new GraphQLList(ChatMessage),
            resolve: (parent: any, args: any) => parent.messages
        }
    })
});
