import React, { useState } from 'react';
import Picker from 'react-mobile-picker';
import { Modal, Button } from 'react-bootstrap';

interface TimePickerProps {
  show: boolean;
  onHide: () => void;
  onTimeSelect: (time: string) => void;
  initialTime?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({ show, onHide, onTimeSelect, initialTime = '' }) => {
  // Parseamos el tiempo inicial
  const parseInitialTime = (time: string) => {
    if (!time) return { hour: '12', minute: '00' };
    const [h, m] = time.split(':');
    return { hour: h, minute: m };
  };

  const { hour: initHour, minute: initMinute } = parseInitialTime(initialTime);
  
  const [selectedTime, setSelectedTime] = useState({
    hour: initHour,
    minute: initMinute
  });

  // Generamos las opciones para las horas (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return hour;
  });

  // Generamos las opciones para los minutos (00, 15, 30, 45)
  const minutes = ['00', '15', '30', '45'];

  const optionGroups = {
    hour: hours,
    minute: minutes
  };

  const handleConfirm = () => {
    const timeString = `${selectedTime.hour}:${selectedTime.minute}`;
    onTimeSelect(timeString);
    onHide();
  };

  const handleCancel = () => {
    // Restaurar al tiempo inicial
    const { hour, minute } = parseInitialTime(initialTime);
    setSelectedTime({ hour, minute });
    onHide();
  };

  return (
    <Modal show={show} onHide={handleCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>🕐 Seleccionar Hora</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ 
          height: '250px', 
          backgroundColor: '#34495e', 
          borderRadius: '15px',
          padding: '20px',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <h4 style={{ color: 'white', marginBottom: '20px', textAlign: 'center' }}>
            Select Time
          </h4>
          <div style={{ width: '100%', height: '180px' }}>
            <Picker
              value={selectedTime}
              onChange={setSelectedTime}
              wheelMode="normal"
              height={160}
              itemHeight={40}
              style={{
                backgroundColor: 'transparent'
              }}
            >
              {Object.keys(optionGroups).map(name => (
                <Picker.Column key={name} name={name}>
                  {optionGroups[name as keyof typeof optionGroups].map(option => (
                    <Picker.Item key={option} value={option}>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'white'
                      }}>
                        {option}
                        {name === 'hour' && <span style={{ fontSize: '14px', color: '#2ecc71', marginLeft: '5px' }}>H</span>}
                        {name === 'minute' && <span style={{ fontSize: '14px', color: '#2ecc71', marginLeft: '5px' }}>M</span>}
                      </div>
                    </Picker.Item>
                  ))}
                </Picker.Column>
              ))}
            </Picker>
          </div>
          <div style={{ 
            position: 'absolute', 
            bottom: '60px', 
            left: '50%', 
            transform: 'translateX(-50%)',
            color: '#bdc3c7',
            fontSize: '14px' 
          }}>
            Press here
          </div>
        </div>
        <div className="text-center mt-3">
          <h5>Hora seleccionada: <span style={{ color: '#007bff' }}>{selectedTime.hour}:{selectedTime.minute}</span></h5>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirmar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TimePicker;
