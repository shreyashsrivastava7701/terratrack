// navigation.js: the list of screens, in the order they appear in the menus.
import Today from './screens/Today.jsx';
import Log from './screens/Log.jsx';
import Insights from './screens/Insights.jsx';
import Wallet from './screens/Wallet.jsx';
import Settings from './screens/Settings.jsx';
import Campus from './screens/Campus.jsx';

export const SCREENS = [
  { id: 'today', label: 'Today', component: Today },
  { id: 'log', label: 'Log', component: Log },
  { id: 'insights', label: 'Insights', component: Insights },
  { id: 'wallet', label: 'Wallet', component: Wallet },
  { id: 'campus', label: 'Campus', component: Campus },
  { id: 'settings', label: 'Settings', component: Settings },
];
