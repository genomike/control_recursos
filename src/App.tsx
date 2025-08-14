import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import TimePicker from './TimePicker';
import './App.css';

interface Recurso {
  id: string;
  nombre: string;
  ocupado: boolean;
  texto: string;
  historial: string[];
  horaContacto?: string;
  notificacionMostrada?: boolean;
  collapsed?: boolean; // Nuevo campo para estado de colapso
}

function App() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [nuevoRecurso, setNuevoRecurso] = useState('');
  const [instalable, setInstalable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentRecursoId, setCurrentRecursoId] = useState<string>('');

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const recursosGuardados = localStorage.getItem('recursos-pwa');
    if (recursosGuardados) {
      setRecursos(JSON.parse(recursosGuardados));
    }

    // Solicitar permisos de notificación
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
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

  // Verificar notificaciones cada minuto
  useEffect(() => {
    const verificarNotificaciones = () => {
      const ahora = new Date();
      const horaActual = ahora.toTimeString().slice(0, 5); // HH:MM

      setRecursos(recursosActuales => 
        recursosActuales.map(recurso => {
          if (recurso.horaContacto && 
              recurso.horaContacto === horaActual && 
              !recurso.notificacionMostrada &&
              'Notification' in window && 
              Notification.permission === 'granted') {
            
            // Mostrar notificación
            new Notification('🔔 Recordatorio de Contacto', {
              body: `Es hora de contactar a ${recurso.nombre}`,
              icon: '/pwa-192x192.png',
              tag: `contacto-${recurso.id}`,
              requireInteraction: true
            });

            return { ...recurso, notificacionMostrada: true };
          }
          
          // Resetear la notificación si la hora cambió
          if (recurso.horaContacto !== horaActual && recurso.notificacionMostrada) {
            return { ...recurso, notificacionMostrada: false };
          }

          return recurso;
        })
      );
    };

    const interval = setInterval(verificarNotificaciones, 60000); // Cada minuto
    verificarNotificaciones(); // Verificar inmediatamente

    return () => clearInterval(interval);
  }, []); // Remover 'recursos' de las dependencias para evitar loop infinito

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

  const actualizarHoraContacto = (id: string, horaContacto: string) => {
    setRecursos(recursos.map(recurso => {
      if (recurso.id === id) {
        return { ...recurso, horaContacto, notificacionMostrada: false };
      }
      return recurso;
    }));
  };

  const abrirTimePicker = (recursoId: string) => {
    setCurrentRecursoId(recursoId);
    setShowTimePicker(true);
  };

  const cerrarTimePicker = () => {
    setShowTimePicker(false);
    setCurrentRecursoId('');
  };

  const seleccionarHora = (time: string) => {
    if (currentRecursoId) {
      actualizarHoraContacto(currentRecursoId, time);
    }
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

  const toggleCollapsed = (id: string) => {
    setRecursos(recursos.map(recurso => {
      if (recurso.id === id) {
        return { ...recurso, collapsed: !recurso.collapsed };
      }
      return recurso;
    }));
  };

  return (
    <Container fluid className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} lg={10} xl={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <Row className="align-items-center">
                <Col>
                  <h2 className="mb-0">🔧 Equipo Desarrollo Compass</h2>
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
                      <Card className={`h-auto ${recurso.ocupado ? 'card-ocupado border-success' : 'card-libre border-danger'}`}>
                        <Card.Header 
                          className={`d-flex justify-content-between align-items-center ${recurso.ocupado ? 'header-ocupado bg-success' : 'header-libre bg-danger'} text-white cursor-pointer`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleCollapsed(recurso.id)}
                        >
                          <div className="d-flex justify-content-between align-items-center w-100">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold">{recurso.nombre}</span>
                              {/* Mostrar hora en el título cuando está colapsado */}
                              {recurso.collapsed && recurso.horaContacto && (
                                <span className="small">🕐 {recurso.horaContacto}</span>
                              )}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              {/* Ícono de colapso */}
                              <span className="text-white">
                                {recurso.collapsed ? '▶️' : '🔽'}
                              </span>
                              <Button
                                variant="outline-light"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Evitar que se active el toggle
                                  eliminarRecurso(recurso.id);
                                }}
                                title="Eliminar recurso"
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                        </Card.Header>
                        
                        {/* Contenido colapsable */}
                        {!recurso.collapsed && (
                          <Card.Body>
                          {/* Checkbox de ocupado y selector de hora en la misma línea */}
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <Form.Check
                              type="checkbox"
                              label="Ocupado"
                              checked={recurso.ocupado}
                              onChange={() => toggleOcupado(recurso.id)}
                            />
                            <div className="d-flex gap-1">
                              <Button
                                variant={recurso.horaContacto ? "info" : "outline-secondary"}
                                size="sm"
                                onClick={() => abrirTimePicker(recurso.id)}
                                className={`btn-time-selector ${recurso.horaContacto ? 'selected' : ''}`}
                              >
                                {recurso.horaContacto ? (
                                  <>🕐 {recurso.horaContacto}</>
                                ) : (
                                  <>🕐 Hora</>
                                )}
                              </Button>
                              {recurso.horaContacto && (
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => actualizarHoraContacto(recurso.id, '')}
                                  title="Limpiar hora"
                                  style={{ minWidth: '32px' }}
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          </div>

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
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* TimePicker Modal */}
      <TimePicker
        show={showTimePicker}
        onHide={cerrarTimePicker}
        onTimeSelect={seleccionarHora}
        initialTime={currentRecursoId ? recursos.find(r => r.id === currentRecursoId)?.horaContacto || '' : ''}
      />
    </Container>
  );
}

export default App;
