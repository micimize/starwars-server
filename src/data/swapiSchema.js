/**
 * Copyright (c) 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString
} from "graphql";

import { makeExecutableSchema } from "graphql-tools";

import { PubSub, SubscriptionManager, withFilter } from "graphql-subscriptions";

import schemaString from "../../schema.graphql";

/**
 * This defines a basic set of data for our Star Wars Schema.
 *
 * This data is hard coded for the sake of the demo, but you could imagine
 * fetching this data from a backend service rather than from hardcoded
 * JSON objects in a more complex demo.
 */
import initialData from "../../data.json";
let { humans, droids, starships } = initialData;

const pubsub = new PubSub();
const ADDED_REVIEW_TOPIC = "new_review";

function mockTableIndex(table) {
  const hashIndex = {};
  table.forEach(record => {
    hashIndex[record.id] = record;
  });
  return hashIndex;
}

const humanData = mockTableIndex(humans);
const droidData = mockTableIndex(droids);
const starshipData = mockTableIndex(starships);

var reviews = {
  NEWHOPE: [],
  EMPIRE: [],
  JEDI: []
};

/**
 * Helper function to get a character by ID.
 */
function getCharacter(id) {
  // Returning a promise just to illustrate GraphQL.js's support.
  return Promise.resolve(humanData[id] || droidData[id]);
}

/**
 * Allows us to query for a character's friends.
 */
function getFriends(character) {
  return character.friends.map(id => getCharacter(id));
}

/**
 * Allows us to fetch the undisputed hero of the Star Wars trilogy, R2-D2.
 */
function getHero(episode) {
  if (episode === "EMPIRE") {
    // Luke is the hero of Episode V.
    return humanData["1000"];
  }
  // Artoo is the hero otherwise.
  return droidData["2001"];
}

/**
 * Allows us to fetch the ephemeral reviews for each episode
 */
function getReviews(episode) {
  return reviews[episode];
}

/**
 * Allows us to query for the human with the given id.
 */
function getHuman(id) {
  return humanData[id];
}

/**
 * Allows us to query for the droid with the given id.
 */
function getDroid(id) {
  return droidData[id];
}

function getStarship(id) {
  return starshipData[id];
}

function toCursor(str) {
  return Buffer("cursor" + str).toString("base64");
}

function fromCursor(str) {
  return Buffer.from(str, "base64")
    .toString()
    .slice(6);
}

const resolvers = {
  Query: {
    hero: (root, { episode }) => getHero(episode),
    character: (root, { id }) => getCharacter(id),
    human: (root, { id }) => getHuman(id),
    droid: (root, { id }) => getDroid(id),
    starship: (root, { id }) => getStarship(id),
    reviews: (root, { episode }) => getReviews(episode),
    search: (root, { text }) => {
      const re = new RegExp(text, "i");

      const allData = [...humans, ...droids, ...starships];

      return allData.filter(obj => re.test(obj.name));
    }
  },
  Mutation: {
    createReview: (root, { episode, review }) => {
      reviews[episode].push(review);
      review.episode = episode;
      pubsub.publish(ADDED_REVIEW_TOPIC, { reviewAdded: review });
      return review;
    }
  },
  Subscription: {
    reviewAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(ADDED_REVIEW_TOPIC),
        (payload, variables) => {
          return (
            payload !== undefined &&
            (variables.episode === null ||
              payload.reviewAdded.episode === variables.episode)
          );
        }
      )
    }
  },
  Character: {
    __resolveType(data, context, info) {
      if (humanData[data.id]) {
        return info.schema.getType("Human");
      }
      if (droidData[data.id]) {
        return info.schema.getType("Droid");
      }
      return null;
    }
  },
  Human: {
    height: ({ height }, { unit }) => {
      if (unit === "FOOT") {
        return height * 3.28084;
      }

      return height;
    },
    friends: ({ friends }) => friends.map(getCharacter),
    friendsConnection: ({ friends }, { first, after }) => {
      first = first || friends.length;
      after = after ? parseInt(fromCursor(after), 10) : 0;
      const edges = friends
        .map((friend, i) => ({
          cursor: toCursor(i + 1),
          node: getCharacter(friend)
        }))
        .slice(after, first + after);
      const slicedFriends = edges.map(({ node }) => node);
      return {
        edges,
        friends: slicedFriends,
        pageInfo: {
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          hasNextPage: first + after < friends.length,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: friends.length
      };
    },
    starships: ({ starships }) => starships.map(getStarship),
    appearsIn: ({ appearsIn }) => appearsIn
  },
  Droid: {
    friends: ({ friends }) => friends.map(getCharacter),
    friendsConnection: ({ friends }, { first, after }) => {
      first = first || friends.length;
      after = after ? parseInt(fromCursor(after), 10) : 0;
      const edges = friends
        .map((friend, i) => ({
          cursor: toCursor(i + 1),
          node: getCharacter(friend)
        }))
        .slice(after, first + after);
      const slicedFriends = edges.map(({ node }) => node);
      return {
        edges,
        friends: slicedFriends,
        pageInfo: {
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          hasNextPage: first + after < friends.length,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: friends.length
      };
    },
    appearsIn: ({ appearsIn }) => appearsIn
  },
  FriendsConnection: {
    edges: ({ edges }) => edges,
    friends: ({ friends }) => friends,
    pageInfo: ({ pageInfo }) => pageInfo,
    totalCount: ({ totalCount }) => totalCount
  },
  FriendsEdge: {
    node: ({ node }) => node,
    cursor: ({ cursor }) => cursor
  },
  Starship: {
    length: ({ length }, { unit }) => {
      if (unit === "FOOT") {
        return length * 3.28084;
      }

      return length;
    },
    coordinates: () => {
      return [[1, 2], [3, 4]];
    }
  },
  SearchResult: {
    __resolveType(data, context, info) {
      if (humanData[data.id]) {
        return info.schema.getType("Human");
      }
      if (droidData[data.id]) {
        return info.schema.getType("Droid");
      }
      if (starshipData[data.id]) {
        return info.schema.getType("Starship");
      }
      return null;
    }
  }
};

/**
 * Finally, we construct our schema (whose starting query type is the query
 * type we defined above) and export it.
 */
export const StarWarsSchema = makeExecutableSchema({
  typeDefs: [schemaString],
  resolvers
});
