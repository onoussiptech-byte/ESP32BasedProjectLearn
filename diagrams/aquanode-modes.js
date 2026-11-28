/* aquanode-modes: boot safe defaults, AUTO and MANUAL, the 30 min expiry, and the safety task above both
 * (ICD 4.6; ControlManager, SafetyManager, OutputManager). Lesson 3.1.5. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['aquanode-modes'] = function (D) {
  D.size(880, 400);
  D.minWidth(660);
  const I = (en, fr) => ({ en, fr });

  D.box(20, 130, 200, 90, { title: I('Boot / reset', 'Démarrage / reset'), sub: I('safe defaults', 'états sûrs'),
    info: I('After power-up or any reset: air pump ON, pump ramps to 60 %, dosing OFF, heater OFF. No dose during the first 10 min.',
      'Après la mise sous tension ou tout reset : pompe à air en marche, pompe montée à 60 %, dosage arrêté, chauffage arrêté. Aucune dose pendant les 10 premières minutes.') });
  D.box(330, 130, 200, 90, { title: 'AUTO', sub: I('firmware decides', 'le firmware décide'),
    info: I('AUTO: PID on the flow, heater with ±0.5 °C hysteresis, pH dose pulses then wait. The phone may go away: AUTO keeps running.',
      'AUTO : PID sur le débit, chauffage avec ±0,5 °C d’hystérésis, impulsions de dose puis attente. Le téléphone peut partir : AUTO continue.') });
  D.box(650, 130, 210, 90, { title: 'MANUAL', sub: I('phone sets pump and air pump', 'le téléphone règle pompe et air'),
    info: I('MANUAL: the phone sets the pump duty and the air pump. It always ends: after 30 min it returns to AUTO, and the air pump cannot stay off more than 10 min.',
      'MANUAL : le téléphone règle la pompe et la pompe à air. Il finit toujours : après 30 min retour en AUTO, et la pompe à air ne reste pas arrêtée plus de 10 min.') });

  D.arrow([[220, 175], [330, 175]], { cls: 'gnd', info: I('The firmware always starts in AUTO.', 'Le firmware démarre toujours en AUTO.') });
  D.note(275, 160, I('start', 'départ'), { anchor: 'middle' });
  D.arrow([[430, 130], [430, 70], [755, 70], [755, 130]], { cls: 'data',
    info: I('The phone sends {"cmd":"mode","value":"MANUAL"}.', 'Le téléphone envoie {"cmd":"mode","value":"MANUAL"}.') });
  D.text(592, 56, '{"cmd":"mode","value":"MANUAL"}', { anchor: 'middle', size: 13, cls: 'dg-mono' });
  D.arrow([[755, 220], [755, 280], [430, 280], [430, 220]], { cls: 'sig',
    info: I('Back to AUTO: by the command {"cmd":"mode","value":"AUTO"}, or by itself 30 min after entering MANUAL.', 'Retour en AUTO : par la commande {"cmd":"mode","value":"AUTO"}, ou tout seul 30 min après l’entrée en MANUAL.') });
  D.text(592, 298, I('{"cmd":"mode","value":"AUTO"}  or  30 min passed', '{"cmd":"mode","value":"AUTO"}  ou  30 min écoulées'), { anchor: 'middle', size: 13, cls: 'dg-mono' });
  D.note(120, 100, I('power cut, crash, watchdog → here', 'coupure, plantage, chien de garde → ici'), { anchor: 'middle' });
  D.note(270, 250, I('phone gone: nothing changes', 'téléphone parti : rien ne change'), { anchor: 'middle' });

  D.box(20, 330, 840, 56, { title: I('Safety task, every 100 ms, above AUTO and MANUAL', 'Tâche de sécurité, toutes les 100 ms, au-dessus d’AUTO et MANUAL'),
    sub: I('LOW_WATER → pump, dosing, heater OFF   ·   SENSOR_FAULT → no dosing   ·   any alarm → fast LED blink', 'LOW_WATER → pompe, dosage, chauffage arrêtés   ·   SENSOR_FAULT → pas de dosage   ·   toute alarme → LED rapide'),
    info: I('SafetyManager runs at the highest priority. Its interlocks win over every mode and every command.', 'SafetyManager tourne à la plus haute priorité. Ses verrous l’emportent sur tous les modes et toutes les commandes.') });
};
