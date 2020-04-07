import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { GqlProvider } from './gqlProvider';
import { User, Chat, ChatMessage, Role } from './schema';
const _ = require('lodash');
const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
    GraphQLInt,
    GraphQLList,
} = graphql;

(async function main()
{
    const app = express();

    app.use('*', cors());
    app.use(compression());

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    const gqlProvider = new GqlProvider()
        .addQueryFields(
        {
            name: 'me',
            properties: {
                type: User,
                resolve: (parent: any, args: any) => users[0]
            }
        })
        .addQueryFields( //TEST - split function
        {
            name: 'user',
            properties: {
                type: User,
                args: {id: {type: GraphQLID}},
                resolve: (parent: any, args: any) => _.find(users, {id: args.id})
            }
        },
        {
            name: 'allUsers',
            properties: {
                type: GraphQLList(User),
                resolve: (parent: any, args: any) => users
            }
        },
        {
            name: 'search',
            properties: {
                type: GraphQLList(User), //TEMP
                args: {term: {type: GraphQLString}},
                resolve: (parent: any, args: any) => {
                    let collection;
                    switch (args.term.toLowerCase()) {
                        case 'users': collection = users; break;
                        case 'chats': collection = chats; break;
                        case 'chatmessages': collection = chatMessages; break;
                        default:
                            collection = _.flatten(_.concat(users, chats, chatMessages));
                            break;
                    }
                    return collection;
                }
            },
        },
        {
            name: 'myChats',
            properties: {
                type: GraphQLList(Chat),
                resolve: (parent: any, args: any) => chats //TEMP
            }
        });

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,
        graphiql: true,
    }));

    try {
        await app.listen(port);
        console.log(`\n--- GraphQL is running on ${address}`);
    }
    catch (err) {
        console.log(`\n*** Error to listen on ${address}. ${err}`)
    }
})();

// Test Data ------------------------------------------------------------------------------------
const users = [
    { name: 'User', id: '0', username: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
    { name: 'User', id: '1', username: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
    { name: 'User', id: '2', username: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
];

const chatMessages = [
    { name: 'ChatMessage', id: '0', content: 'aaaaaaa', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '1', content: 'bbbbbbb', time: Date.parse('2020-04-07'), author: users[1] },
    { name: 'ChatMessage', id: '2', content: 'ccccccc', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '3', content: 'ddddddd', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '4', content: 'eeeeeee', time: Date.parse('2020-04-07'), author: users[2] },
];

const chats = [
    { name: 'Chat', id: '0', participants: [users[0], users[1], users[2]], messages: [chatMessages[0], chatMessages[1]] },
    { name: 'Chat', id: '1', participants: [users[1], users[0]], messages: [chatMessages[1], chatMessages[2], chatMessages[3]] },
    { name: 'Chat', id: '2', participants: [users[0], users[1]], messages: [chatMessages[2], chatMessages[1]] },
    { name: 'Chat', id: '3', participants: [users[2], users[0]], messages: [chatMessages[4], chatMessages[1], chatMessages[2]] },
];
// -----------------------------------------------------------------------------------------

/* Queries

query {
  me {
	id
    email
  }
}

query {
  user(id: 1) {
	username
    id
  }
}

query {
  allUsers {
	role
    username
    id
  }
}

query {
  search(term: "Users") {
	id
    email
  }
}

query {
  myChats {
		id
    participants {
      username
    }
    messages {
      author {
      	username
    	}
      content
    }
  }
}

*/



