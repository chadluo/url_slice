import { isPerfEnabled, setPerfEnabled } from '../../utils/perf.ts';
import '../../assets/style.css';

const perf = document.querySelector<HTMLInputElement>('#perf')!;
perf.checked = isPerfEnabled();
perf.addEventListener('change', () => setPerfEnabled(perf.checked));
