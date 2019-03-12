# Star Wars testing server
`npm install starwars-test-graphql-server` and `npm starwars-test-graphql-server` gets you a testing server on port `process.env.PORT || 8080`. The base data can be found in `data.json` and the schema in `schema.graphql`. Use for validating your graphql clients, writing example apps, etc.

This is mostly unchanged from it's [upstream](https://github.com/apollographql/starwars-server/pull/12) counterpart, I just wanted it bundled and published as a module with the data and schema decoupled.

# Example server details:

This is a really simple GraphQL server that uses [Apollo Server](https://github.com/apollostack/apollo-server) and [GraphQL Tools](https://github.com/apollostack/graphql-tools) to serve the Star Wars example schema from http://www.graphql.org.

## Installation

Clone the repository and run `npm install`

```
git clone https://github.com/apollographql/starwars-server
cd starwars-server
npm install
```

## Starting the server

```
npm start
```

The server will run on port 8080. You can change this by editing `server.js`.
