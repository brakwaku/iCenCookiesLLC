import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_PRODUCT } from '../graphql/queries';

const ProductDetailsScreen = () => {
  const { productId } = useParams();
  const { loading, error, data } = useQuery(GET_PRODUCT, {
    variables: { id: productId },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const { product } = data;

  return (
    <div>
      <h1>{product.name} Details</h1>
      <p>{product.description}</p>
      {/* Add to cart button or functionality */}
      <Link to="/">Back to Products</Link>
    </div>
  );
}

export default ProductDetailsScreen