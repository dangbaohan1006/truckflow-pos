from typing import List, Optional
import logging
import os

try:
    from escpos.printer import Network, Usb
except Exception:
    Network = None
    Usb = None

logger = logging.getLogger(__name__)


def _print_lines_network(host: str, port: int, lines: List[str]):
    if Network is None:
        raise RuntimeError('python-escpos not installed')
    p = Network(host, port=port, timeout=10)
    try:
        for l in lines:
            p.text(str(l) + "\n")
        p.cut()
    finally:
        try:
            p.close()
        except Exception:
            pass


def _print_lines_usb(idVendor: int, idProduct: int, lines: List[str]):
    if Usb is None:
        raise RuntimeError('python-escpos not installed')
    p = Usb(idVendor, idProduct)
    try:
        for l in lines:
            p.text(str(l) + "\n")
        p.cut()
    finally:
        try:
            p.close()
        except Exception:
            pass


def print_receipt(lines: List[str], printer: Optional[dict] = None):
    """Print receipt using given printer config.

    printer: { type: 'network'|'usb', host, port } or { type: 'usb', idVendor, idProduct }
    If `printer` is None, attempt to read default printer configuration from environment variables:
      PRINTER_TYPE, PRINTER_HOST, PRINTER_PORT, PRINTER_IDVENDOR, PRINTER_IDPRODUCT
    """
    # If no printer provided, try env vars (PRINTER_TYPE, PRINTER_HOST, PRINTER_PORT, PRINTER_IDVENDOR, PRINTER_IDPRODUCT)
    if not printer:
        ptype = os.environ.get('PRINTER_TYPE')
        if ptype:
            printer = { 'type': ptype }
            if ptype == 'network':
                printer['host'] = os.environ.get('PRINTER_HOST')
                printer['port'] = int(os.environ.get('PRINTER_PORT', '9100'))
            elif ptype == 'usb':
                printer['idVendor'] = int(os.environ.get('PRINTER_IDVENDOR', '0'))
                printer['idProduct'] = int(os.environ.get('PRINTER_IDPRODUCT', '0'))
        else:
            raise ValueError('printer configuration required')

    ptype = printer.get('type')
    if ptype == 'network':
        host = printer.get('host')
        port = int(printer.get('port', 9100))
        if not host:
            raise ValueError('host required for network printer')
        return _print_lines_network(host, port, lines)
    elif ptype == 'usb':
        idVendor = int(printer.get('idVendor'))
        idProduct = int(printer.get('idProduct'))
        return _print_lines_usb(idVendor, idProduct, lines)
    else:
        raise ValueError('unknown printer type')
