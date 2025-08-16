import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useRealTimeSync } from './useRealTimeSync';
import { realTimeSync } from './realTimeSync';
import { offlineDB } from './offlineDB';
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
  collapsed?: boolean;
}

function App() {
  const [showAddPanel, setShowAddPanel] = useState(false);

  // 🔄 SINCRONIZACIÓN EN TIEMPO REAL
  const {
    isLoading,
    forceSync,
    activeInstances,
    instanceId
  } = useRealTimeSync({
    autoRefresh: true,
    enableNotifications: true
  });

  // Estado local para recursos (mantenemos compatibilidad)
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [nuevoRecurso, setNuevoRecurso] = useState('');
  const [instalable, setInstalable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentRecursoId, setCurrentRecursoId] = useState<string>('');

  // Referencia para el input del formulario flotante
  const inputRef = useRef<HTMLInputElement>(null);

  // Inicializar base de datos offline
  useEffect(() => {
    const initDB = async () => {
      try {
        await offlineDB.init();
        console.log('✅ Base de datos offline inicializada');
      } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
      }
    };

    initDB();
  }, []);

  // Cargar datos del localStorage al iniciar (compatibilidad)
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

  // Guardar en localStorage cada vez que cambien los recursos (compatibilidad)
  useEffect(() => {
    localStorage.setItem('recursos-pwa', JSON.stringify(recursos));
  }, [recursos]);

  // 🔄 LISTENERS PARA SINCRONIZACIÓN DE RECURSOS EN TIEMPO REAL
  useEffect(() => {
    const handleRecursoSync = (data: any) => {
      const { action, recurso, recursoId } = data;
      
      console.log('🔄 Sincronización de recurso recibida:', action, recurso);
      
      switch (action) {
        case 'recurso-created':
          setRecursos(prevRecursos => {
            // Evitar duplicados
            const exists = prevRecursos.some(r => r.id === recurso.id);
            if (exists) return prevRecursos;
            
            console.log('✅ Agregando nuevo recurso:', recurso.nombre);
            return [...prevRecursos, recurso];
          });
          
          // Mostrar notificación
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🆕 Nuevo recurso agregado', {
              body: `${recurso.nombre} fue agregado por otra instancia`,
              icon: '/pwa-192x192.png'
            });
          }
          break;
          
        case 'recurso-updated':
          setRecursos(prevRecursos => {
            console.log('🔄 Actualizando recurso:', recurso.nombre);
            return prevRecursos.map(r => 
              r.id === recursoId ? { ...recurso } : r
            );
          });
          break;
          
        case 'recurso-deleted':
          setRecursos(prevRecursos => {
            console.log('🗑️ Eliminando recurso:', recursoId);
            return prevRecursos.filter(r => r.id !== recursoId);
          });
          
          // Mostrar notificación
          if ('Notification' in window && Notification.permission === 'granted' && recurso) {
            new Notification('🗑️ Recurso eliminado', {
              body: `${recurso.nombre} fue eliminado por otra instancia`,
              icon: '/pwa-192x192.png'
            });
          }
          break;
      }
    };

    // Registrar listener para cambios de datos
    realTimeSync.on('data-changed', handleRecursoSync);

    // Cleanup
    return () => {
      realTimeSync.off('data-changed', handleRecursoSync);
    };
  }, []);

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

  // Manejar click fuera del panel flotante
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Si el panel está abierto y el click fue fuera del contenedor
      if (showAddPanel && !target.closest('.floating-add-container-header')) {
        setShowAddPanel(false);
      }
    };

    if (showAddPanel) {
      // Solo agregar el listener cuando el panel está abierto
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showAddPanel]);

  // Enfocar el input cuando se abre el panel (simplificado)
  useEffect(() => {
    if (showAddPanel && inputRef.current) {
      // Solo un intento simple de foco
      setTimeout(() => {
        if (inputRef.current) {
          try {
            inputRef.current.focus();
          } catch (error) {
            console.warn('No se pudo enfocar el input:', error);
          }
        }
      }, 100);
    }
  }, [showAddPanel]);

  // 🔄 FUNCIONES CON SINCRONIZACIÓN EN TIEMPO REAL
  const agregarRecurso = async () => {
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

      // 🔄 Sincronizar directamente el recurso con otras instancias
      realTimeSync.broadcast({
        type: 'data-changed',
        data: { 
          action: 'recurso-created',
          recurso: nuevoRecursoObj
        },
        timestamp: Date.now()
      });
    }
  };

  const eliminarRecurso = async (id: string) => {
    const recursoEliminado = recursos.find(r => r.id === id);
    setRecursos(recursos.filter(recurso => recurso.id !== id));
    
    // 🔄 Sincronizar eliminación
    realTimeSync.broadcast({
      type: 'data-changed',
      data: { 
        action: 'recurso-deleted',
        recursoId: id,
        recurso: recursoEliminado
      },
      timestamp: Date.now()
    });
  };

  const toggleOcupado = async (id: string) => {
    const recursoActualizado = recursos.map(recurso => {
      if (recurso.id === id) {
        return { ...recurso, ocupado: !recurso.ocupado };
      }
      return recurso;
    });
    
    setRecursos(recursoActualizado);

    // 🔄 Sincronizar cambio de estado
    const recurso = recursoActualizado.find(r => r.id === id);
    if (recurso) {
      realTimeSync.broadcast({
        type: 'data-changed',
        data: { 
          action: 'recurso-updated',
          recursoId: id,
          recurso: recurso
        },
        timestamp: Date.now()
      });
    }
  };

  const actualizarTexto = async (id: string, texto: string) => {
    const recursoActualizado = recursos.map(recurso => {
      if (recurso.id === id) {
        const recursoNuevo = { ...recurso, texto };
        
        // Si el texto se vació, desmarcar ocupado y agregar al historial
        if (texto.trim() === '' && recurso.texto.trim() !== '') {
          // Agregar al historial (máximo 3 elementos, FIFO)
          const nuevoHistorial = [recurso.texto, ...recurso.historial].slice(0, 3);
          return {
            ...recursoNuevo,
            ocupado: false,
            historial: nuevoHistorial
          };
        }
        
        return recursoNuevo;
      }
      return recurso;
    });
    
    setRecursos(recursoActualizado);

    // 🔄 Sincronizar actualización de texto
    const recurso = recursoActualizado.find(r => r.id === id);
    if (recurso) {
      realTimeSync.broadcast({
        type: 'data-changed',
        data: { 
          action: 'recurso-updated',
          recursoId: id,
          recurso: recurso
        },
        timestamp: Date.now()
      });
    }
  };

  const actualizarHoraContacto = async (id: string, horaContacto: string) => {
    const recursoActualizado = recursos.map(recurso => {
      if (recurso.id === id) {
        return { ...recurso, horaContacto, notificacionMostrada: false };
      }
      return recurso;
    });
    
    setRecursos(recursoActualizado);

    // 🔄 Sincronizar actualización de hora
    const recurso = recursoActualizado.find(r => r.id === id);
    if (recurso) {
      realTimeSync.broadcast({
        type: 'data-changed',
        data: { 
          action: 'recurso-updated',
          recursoId: id,
          recurso: recurso
        },
        timestamp: Date.now()
      });
    }
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
              <Row className="align-items-start align-items-md-center gy-2">
                <Col xs="auto" className="align-self-center">
                  <h2 className="mb-0">💎 Recursos</h2>
                  {isLoading && <div className="small mt-1"><span>⏳ Sincronizando...</span></div>}
                </Col>
                <Col xs="auto" className="align-self-center">
                  {/* 🔄 INFORMACIÓN DE SINCRONIZACIÓN */}
                  <div className="ms-md-4" style={{ fontSize: '0.75rem', lineHeight: '1.1' }}>
                    <div>🔄 Instancias activas: {activeInstances}</div>
                    <div>🆔 ID: {instanceId.slice(-8)}</div>
                    <div>📦 Recursos: {recursos.length}</div>
                  </div>
                </Col>
                <Col></Col>
                <Col xs="auto" className="d-flex gap-2 align-self-center">
                  {/* ➕ BOTÓN FLOTANTE PARA AGREGAR RECURSOS */}
                  <div className="floating-add-container-header">
                    <div className="floating-add-trigger-header">
                      <Button 
                        variant="light" 
                        size="sm"
                        className="floating-add-btn-header"
                        onClick={() => setShowAddPanel(!showAddPanel)}
                      >
                        ➕ Nuevo
                      </Button>
                      
                      {/* Panel deslizante que aparece en click */}
                      <div 
                        className={`floating-add-panel-header ${showAddPanel ? 'show-panel' : ''}`}
                      >
                        <Card className="shadow-lg border-success">
                          <Card.Header className="bg-success text-white py-2">
                            <div className="d-flex justify-content-start align-items-center">
                              <h6 className="mb-0">➕ Nuevo Recurso</h6>
                            </div>
                          </Card.Header>
                          <Card.Body className="p-3">
                            <Row>
                              <Col xs={12} className="mb-2">
                                <Form.Control
                                  ref={inputRef}
                                  type="text"
                                  placeholder="Nombre del recurso..."
                                  value={nuevoRecurso}
                                  onChange={(e) => setNuevoRecurso(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      agregarRecurso();
                                      setShowAddPanel(false);
                                    }
                                  }}
                                  size="sm"
                                  tabIndex={showAddPanel ? 0 : -1}
                                />
                              </Col>
                              <Col xs={12}>
                                <div className="d-flex gap-2">
                                  <Button 
                                    variant="success" 
                                    onClick={() => {
                                      agregarRecurso();
                                      setShowAddPanel(false);
                                    }}
                                    disabled={!nuevoRecurso.trim()}
                                    className="flex-grow-1"
                                    size="sm"
                                  >
                                    ✅ Crear
                                  </Button>
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={() => setNuevoRecurso('')}
                                  >
                                    🔄
                                  </Button>
                                </div>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      </div>
                    </div>
                  </div>
                  
                  {/* 🔄 BOTÓN DE SINCRONIZACIÓN FORZADA */}
                  <Button 
                    variant="light" 
                    size="sm" 
                    onClick={forceSync}
                    title="Forzar sincronización"
                  >
                    🔄 Sync
                  </Button>
                  
                  {instalable && (
                    <Button variant="light" size="sm" onClick={instalarPWA}>
                      📱 Instalar App
                    </Button>
                  )}
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              {/* Lista de recursos */}
              {recursos.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <h5>📋 No hay recursos disponibles</h5>
                  <p className="mb-0">Usa el botón flotante de arriba para agregar tu primer recurso</p>
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
                              {/* Botón de limpiar texto (esponja) */}
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => actualizarTexto(recurso.id, '')}
                                title="Limpiar texto"
                                style={{ minWidth: '32px' }}
                              >
                                🧽
                              </Button>
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
