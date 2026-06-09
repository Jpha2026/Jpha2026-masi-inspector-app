export type Inspector = {
  id: string;
  name: string;
  email: string;
};

export type Equipment = {
  id: string;
  qr_code: string;
  name: string;
  type: string;
  location: string;
  serial_number: string;
};

export type Sucursal = {
  id: string;
  name: string;
  client_id: string;
  address: string;
  cliente_name: string;
};

export type Cliente = {
  id: string;
  name: string;
};

export type Levantamiento = {
  id: string;
  folio: string;
  inspector_id: string;
  client_id: string;
  sucursal_id: string;
  department: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: "pendiente" | "en_proceso" | "completada";
  comments: string;
  created_at: string;
  inspector_name?: string;
  cliente_name?: string;
  sucursal_name?: string;
  puntos_count?: number;
};

export type PuntoInspeccion = {
  id: string;
  levantamiento_id: string;
  area: string;
  serial_number: string;
  brand: string;
  extinguisher_type: string;
  capacity: string;
  accessible: string;
  signaled: string;
  cabinet: string;
  charge_status: string;
  hose_nozzle: string;
  safety_pin: string;
  cylinder: string;
  observations: string;
  photos: string; // JSON string of photo URLs
};

export type ItemResult = "PASS" | "FAIL" | "NA";

export type InspectionItem = {
  category: string;
  item_name: string;
  result: ItemResult;
  comment: string;
};

export type Inspection = {
  id: string;
  inspector_id: string;
  equipment_id: string;
  equipment_name?: string;
  equipment_type?: string;
  overall_result: "PASS" | "FAIL" | "CONDITIONAL";
  notes: string;
  submitted_at: string;
  lat?: number;
  lng?: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "inspector" | "empleado" | "cliente";
  inspector_id: string | null;
  employee_id: string | null;
  permissions: string[];
};

export type Solicitud = {
  id: string;
  folio: string;
  employee_id: string;
  tipo: "vacaciones" | "permiso_con_goce" | "permiso_sin_goce" | "prestamo" | "incapacidad" | "llegada_tarde" | "otro";
  fecha_inicio: string;
  fecha_fin: string | null;
  dias: number | null;
  monto: number | null;
  motivo: string;
  foto_url: string | null;
  status: "pendiente" | "aprobado" | "rechazado";
  aprobado_por: string | null;
  fecha_resolucion: string | null;
  notas_rh: string | null;
  created_at: string;
};

export type PedidoItem = {
  id?: string;
  category: string;
  item_name: string;
  quantity: number;
  unit: string;
  notes?: string;
};

export type Pedido = {
  id: string;
  folio: string;
  employee_id: string;
  department: string;
  notes: string;
  status: "pendiente" | "aprobado" | "rechazado" | "entregado";
  created_at: string;
  items: PedidoItem[];
};

export type KardexEntry = {
  id: string;
  evento: string;
  fecha: string;
  descripcion: string;
  registrado_por: string;
};

export type OrdenTrabajo = {
  id: string;
  folio: string;
  tipo: string;
  status: "abierta" | "en_proceso" | "cerrada" | "cancelada";
  client_name: string;
  notes: string;
  priority: string;
  due_date: string | null;
  created_at: string;
};

export type RutaItem = {
  id: string;
  ruta_id: string;
  equipment_id: string | null;
  expected_qr: string;
  equipment_name: string;
  equipment_type: string;
  location: string;
  serial_number: string;
  order_num: number;
  status: "pendiente" | "inspeccionado" | "no_acceso";
  inspection_id: string | null;
  scanned_at: string | null;
};

export type Ruta = {
  id: string;
  route_number: number;
  name: string;
  inspector_id: string;
  client_id: string;
  sucursal_id: string | null;
  scheduled_date: string;
  frequency: string;
  status: "programada" | "en_proceso" | "completada" | "cancelada";
  notes: string;
  cliente_name: string;
  sucursal_name: string | null;
  total_items: number;
  done_items: number;
  items?: RutaItem[];
};

export type RootStackParamList = {
  Login: undefined;
  Home: { inspectorId: string };
  Scan: { inspectorId: string; rutaId?: string; rutaItemId?: string; expectedQr?: string };
  Inspection: { inspectorId: string; equipment: Equipment; rutaId?: string; rutaItemId?: string };
  Levantamiento: { inspectorId: string };
  EmpleadoHome: { user: AppUser };
  MisSolicitudes: { user: AppUser };
  NuevaSolicitud: { user: AppUser };
  Pedido: { user: AppUser };
  Taller: { inspectorId: string; userName: string };
  Route: { inspectorId: string; ruta: Ruta };
  Chat: { userEmail: string; userName: string };
};
