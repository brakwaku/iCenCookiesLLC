// queries.js
import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts {
    getAllProducts {
      _id
      name
      description
      price
    }
  }
`;

export const GET_PRODUCT = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
      _id
      name
      description
      # Add other fields as needed
    }
  }
`;

// mutations.js
export const SIGN_IN = gql`
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      user {
        _id
        name
      }
    }
  }
`;

// Add other queries and mutations as needed
