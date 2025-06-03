import Layout from "../../common/components/Layout";
import Chat from "./Chat";

const Home = () => {
    return (
        <Layout
            content={<Chat />}
        />
    );
};

export default Home;
