import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { GqlProvider } from './gqlProvider';
import { User, Chat, ChatMessage, Role } from './schema';
import {DocumentNode, ExecutionArgs, ExecutionResult, GraphQLError, GraphQLFieldResolver, Source} from "graphql";
import {Options} from "graphql-depth-limit";
const _ = require('lodash');
const graphql = require('graphql');

(async function main()
{
    const app = express();

    app.use('*', cors());
    app.use(compression());

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    const gqlProvider = new GqlProvider();

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,
        graphiql: true,
        // rootValue: (args: any) => {
        //   console.log('rootValue');
        // },
        customExecuteFn: (args: ExecutionArgs): /*Promise<ExecutionResult>*/any => {
            console.log('** start customExecuteFn');
            let definition: any = args.document.definitions[0];
            let loc: any = definition.loc;
            console.log('** end customExecuteFn');
            return gqlProvider.executeFn(args.document.definitions[0])[0].value;
        },
        // fieldResolver: (args: any): any => {
        //     console.log('fieldResolver');
        // },
        // typeResolver: (args: any): any => {
        //     console.log('typeResolver');
        // },
        // customParseFn: (source: Source): any => {
        //     console.log(source);
        //     return false;
        // },
        customFormatErrorFn: (error: GraphQLError) => {
            console.log('customFormatErrorFn');
        },
        customValidateFn: (schema, documentAST, validationRules): any => {
            console.log('** start customValidateFn');
            console.log('** end customValidateFn');
            return true;
        },
    }));

    try {
        await app.listen(port);
        console.log(`\n--- GraphQL is running on ${address}`);
    }
    catch (err) {
        console.log(`\n*** Error to listen on ${address}. ${err}`)
    }

    gqlProvider.resolveFunctions['user'] = (args) => {
        return JSON.stringify(users[args.args[0].value]);
    }

})();

// Test Data ------------------------------------------------------------------------------------
export const users = [
    { name: 'User', id: '0', username: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
    { name: 'User', id: '1', username: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
    { name: 'User', id: '2', username: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
];

export const chatMessages = [
    { name: 'ChatMessage', id: '0', content: 'aaaaaaa', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '1', content: 'bbbbbbb', time: Date.parse('2020-04-07'), author: users[1] },
    { name: 'ChatMessage', id: '2', content: 'ccccccc', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '3', content: 'ddddddd', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: '4', content: 'eeeeeee', time: Date.parse('2020-04-07'), author: users[2] },
];

export const chats = [
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



