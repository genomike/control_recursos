import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import './App.css';

interface Recurso {
  id: string;
  nombre: string;
  ocupado: boolean;
  texto: string;
  historial: string[];
}

function App() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [nuevoRecurso, setNuevoRecurso] = useState('');
  const [instalable, setInstalable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const recursosGuardados = localStorage.getItem('recursos-pwa');
    if (recursosGuardados) {
      setRecursos(JSON.parse(recursosGuardados));
    }

    // Detectar si la PWA puede ser instalada
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Guardar en localStorage cada vez que cambien los recursos
  useEffect(() => {
    localStorage.setItem('recursos-pwa', JSON.stringify(recursos));
  }, [recursos]);

  const agregarRecurso = () => {
    if (nuevoRecurso.trim()) {
      const nuevoRecursoObj: Recurso = {
        id: Date.now().toString(),
        nombre: nuevoRecurso.trim(),
        ocupado: false,
        texto: '',
        historial: []
      };
      setRecursos([...recursos, nuevoRecursoObj]);
      setNuevoRecurso('');
    }
  };

  const eliminarRecurso = (id: string) => {
    setRecursos(recursos.filter(recurso => recurso.id !== id));
  };

  const toggleOcupado = (id: string) => {
    setRecursos(recursos.map(recurso => {
      if (recurso.id === id) {
        return { ...recurso, ocupado: !recurso.ocupado };
      }
      return recurso;
    }));
  };

  const actualizarTexto = (id: string, texto: string) => {
    setRecursos(recursos.map(recurso => {
      if (recurso.id === id) {
        const recursoActualizado = { ...recurso, texto };
        
        // Si el texto se vació, desmarcar ocupado y agregar al historial
        if (texto.trim() === '' && recurso.texto.trim() !== '') {
          // Agregar al historial (máximo 3 elementos, FIFO)
          const nuevoHistorial = [recurso.texto, ...recurso.historial].slice(0, 3);
          return {
            ...recursoActualizado,
            ocupado: false,
            historial: nuevoHistorial
          };
        }
        
        return recursoActualizado;
      }
      return recurso;
    }));
  };

  const instalarPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setInstalable(false);
      }
    }
  };

  return (
    <Container fluid className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} lg={10} xl={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <Row className="align-items-center">
                <Col>
                  <h2 className="mb-0">🔧 Gestor de Recursos PWA</h2>
                </Col>
                <Col xs="auto">
                  {instalable && (
                    <Button variant="light" size="sm" onClick={instalarPWA}>
                      📱 Instalar App
                    </Button>
                  )}
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              {/* Sección para agregar nuevos recursos */}
              <Row className="mb-4">
                <Col>
                  <Card className="bg-light">
                    <Card.Body>
                      <h5 className="mb-3">➕ Agregar Nuevo Recurso</h5>
                      <Row>
                        <Col xs={12} md={8} lg={9}>
                          <Form.Control
                            type="text"
                            placeholder="Nombre del recurso..."
                            value={nuevoRecurso}
                            onChange={(e) => setNuevoRecurso(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && agregarRecurso()}
                          />
                        </Col>
                        <Col xs={12} md={4} lg={3} className="mt-2 mt-md-0">
                          <Button 
                            variant="success" 
                            onClick={agregarRecurso}
                            disabled={!nuevoRecurso.trim()}
                            className="w-100"
                          >
                            Añadir
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Lista de recursos */}
              {recursos.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <h5>📝 No hay recursos registrados</h5>
                  <p className="mb-0">Agrega tu primer recurso para comenzar</p>
                </Alert>
              ) : (
                <Row>
                  {recursos.map((recurso) => (
                    <Col xs={12} md={6} lg={4} key={recurso.id} className="mb-4">
                      <Card className={`h-100 ${recurso.ocupado ? 'border-warning' : 'border-success'}`}>
                        <Card.Header className={`d-flex justify-content-between align-items-center ${recurso.ocupado ? 'bg-warning' : 'bg-success'} text-white`}>
                          <span className="fw-bold">{recurso.nombre}</span>
                          <Button
                            variant="outline-light"
                            size="sm"
                            onClick={() => eliminarRecurso(recurso.id)}
                          >
                            🗑️
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          {/* Checkbox de ocupado */}
                          <Form.Check
                            type="checkbox"
                            label="Ocupado"
                            checked={recurso.ocupado}
                            onChange={() => toggleOcupado(recurso.id)}
                            className="mb-3"
                          />

                          {/* Área de texto */}
                          <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Escribe aquí los detalles del recurso..."
                            value={recurso.texto}
                            onChange={(e) => actualizarTexto(recurso.id, e.target.value)}
                            className="mb-3"
                          />

                          {/* Historial */}
                          {recurso.historial.length > 0 && (
                            <div>
                              <h6 className="text-muted mb-2">📝 Historial:</h6>
                              {recurso.historial.map((item, index) => (
                                <div
                                  key={index}
                                  className="text-muted small mb-1"
                                  style={{ textDecoration: 'line-through' }}
                                >
                                  {item}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default App;
