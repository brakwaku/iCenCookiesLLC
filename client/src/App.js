import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Layout from "./Screens/Layout";
import Home from "./Screens/Home";
import ProductDetailsScreen from "./Screens/ProductDetailsScreen";
import SignInScreen from "./Screens/SignInScreen";
import CartScreen from "./Screens/CartScreen";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" exact element={<Layout />}>
          <Route index  element={<Home />} />
          <Route path="/product/:id" element={ProductDetailsScreen} />
          <Route path="/signin" element={SignInScreen} />
          <Route path="/cart" element={CartScreen} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
