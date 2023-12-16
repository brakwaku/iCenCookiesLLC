import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_PRODUCTS } from '../graphql/queries';

const Home = () => {
  const { loading, error, data } = useQuery(GET_PRODUCTS);

  console.log('data', data?.getAllProducts, error, loading);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {data?.getAllProducts && data?.getAllProducts?.map((product, index) => (
        <div key={index}>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <Link to={`/product/${product._id}`}>View Details</Link>
          {/* Add to cart button or functionality */}
        </div>
      ))}
    </div>
  );
}

export default Home