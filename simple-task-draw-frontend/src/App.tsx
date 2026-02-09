import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Objectives from "./pages/Objectives";
import CreateObjective from "./pages/CreateObjective";
import EditObjective from "./pages/EditObjective";
import Practice from "./pages/Practice";
import Progress from "./pages/Progress";

export default function App() {
  return (
    <div className="app-shell">
      <Navbar expand="lg" className="bg-white shadow-sm" sticky="top">
        <Container>
          <Navbar.Brand as={Link} to="/">
            Simple Task Draw
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-auto gap-2">
              <Nav.Link as={Link} to="/">
                Telemetry
              </Nav.Link>
              <Nav.Link as={Link} to="/objectives">
                Objectives
              </Nav.Link>
              <Nav.Link as={Link} to="/create">
                Create
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="app-main">
        <Container>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/objectives/*" element={<Objectives />} />
            <Route path="/create" element={<CreateObjective />} />
            <Route path="/edit/*" element={<EditObjective />} />
            <Route path="/practice/*" element={<Practice />} />
            <Route path="/progress/*" element={<Progress />} />
          </Routes>
        </Container>
      </main>
    </div>
  );
}
