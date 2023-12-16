import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_PRODUCTS } from '../graphql/queries';

const Home = () => {
  const { loading, error, data } = useQuery(GET_PRODUCTS);

  console.log('data', data, error, loading);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>Landing Page</h1>
      {data && data.products.map((product) => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <Link to={`/product/${product.id}`}>View Details</Link>
          {/* Add to cart button or functionality */}
        </div>
      ))}
      <p>Error: {error}</p>
    </div>
  );
}

export default Home