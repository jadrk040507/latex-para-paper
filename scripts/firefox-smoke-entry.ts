import { createInputPort } from '../probe/src/paper-port';
import { startController } from '../probe/src/controller';
const doc = document;
const control = startController(doc, createInputPort(doc, () => doc.querySelector<HTMLInputElement>('#equation')));
Object.assign(window, { smokeControl: control });
