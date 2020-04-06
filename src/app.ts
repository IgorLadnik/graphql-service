import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import {GqlSchemaParser} from './gqlSchemaParser';
import {GraphQLResolveInfo} from 'graphql';
import _ from "lodash";

const strSchema = `
scalar Date

schema {
    query: Query
}

type Query {
    me: User!
    user(id: ID!): User
    allUsers: [User]
    search(term: String!): [SearchResult!]!
    myChats: [Chat!]!
}

enum Role {
    USER,
    ADMIN,
}

interface Node {
    id: ID!
    common: String!
}

union SearchResult = User | Chat | ChatMessage

type User implements Node {
    id: ID!
    common: String!
    username: String!
    email: String!
    role: Role!
}

type Chat implements Node {
    id: ID!
    common: String!
    users: [User!]!
    messages: [ChatMessage!]!
}

type ChatMessage implements Node {
    id: ID!
    common: String!
    content: String!
    time: Date!
    user: User!
}
`;

(async function main()
{
    const gqlSchemaParser = await new GqlSchemaParser(strSchema);

    // Data ------------------------------------------------------------------------------------
    const users = [
        {__typename: 'User', id: '0', common: 'aa', username: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: 'ADMIN'/*Role.Admin*/},
        {__typename: 'User', id: '1', common: 'cc', username: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: 'USER'/*Role.User*/},
        {__typename: 'User', id: '2', common: 'dd', username: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: 'USER'/*Role.User*/},
    ];

    const chatMessages = [
        {__typename: 'ChatMessage', id: '0', common: 'ee', content: 'aaaaaaa', time: Date.parse('2020-04-05'), user: users[1]},
        {__typename: 'ChatMessage', id: '1', common: 'ff', content: 'bbbbbbb', time: Date.parse('2020-04-05'), user: users[2]},
    ];

    const chats = [
        {__typename: 'Chat', id: '0', common: 'gg', users: [users[0], users[2]], messages: [chatMessages[0], chatMessages[1]]},
        {__typename: 'Chat', id: '1', common: 'hh', users: [users[1], users[0]], messages: [chatMessages[0], chatMessages[1]]},
    ];
    // -----------------------------------------------------------------------------------------

    const app = express();

    app.use('*', cors());
    app.use(compression());

    app.use('/graphql', graphqlHTTP({
        schema: gqlSchemaParser.schema,
        rootValue: gqlSchemaParser.resolvers, // possibly before adding actual resolvers
        graphiql: true,
    }));

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    try {
        await app.listen(port);
        console.log(`\n--- GraphQL is running on ${address}`);

        setResolversAfterStartListening(gqlSchemaParser, users, chats, chatMessages);
    }
    catch (err) {
        console.log(`\n*** Error to listen on ${address}. ${err}`)
    }
})();

function setResolversAfterStartListening(gqlSchemaParser: GqlSchemaParser,
                                         users: Array<any>, chats: Array<any>, chatMessages: Array<any>) {
    gqlSchemaParser.setResolvers(
      //-------------------------------------------------------------------------------------------
      { resolverName: 'me',
        fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
            console.log('resolver: me');
            return users[0];
        }
      },
      //-------------------------------------------------------------------------------------------
      {
        resolverName: 'user',
        fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
            //_.filter(pms, pm => pm.id === parent.id)[0]?.name
            console.log(`resolver: user(${parent.id})`);
            return users[parent.id];
        }
      },
      //-------------------------------------------------------------------------------------------
      {
        resolverName: 'allUsers',
        fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
            console.log('resolver: allUsers');
            return users;
        }
      },
      //-------------------------------------------------------------------------------------------
      {
        resolverName: 'search',
        fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
            console.log(`resolver: parent.id = ${parent.term}`);
            let collection;
            switch (parent.term.toLowerCase()) {
                case 'users': collection = users; break;
                case 'chats': collection = chats; break;
                case 'chatmessages': collection = chatMessages; break;
                default: collection = _.flatten(_.concat(users, chats, chatMessages)); break;
            }
            return collection;
        }
      },
      //-------------------------------------------------------------------------------------------
      {
        resolverName: 'myChats',
        fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
           console.log('resolver: myChats');
           return chats; //TEMP
        }
      },
        //-------------------------------------------------------------------------------------------
    );
}
