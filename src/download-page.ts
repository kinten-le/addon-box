import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

GObject.registerClass({
  GTypeName: 'DownloadPage',
  // @ts-ignore
  Template: 'resource:///com/github/kinten108101/SteamVpk/ui/download-page.ui',
}, class extends Gtk.Box {});