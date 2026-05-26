"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  ArrowRight,
  Filter,
  Settings,
  Trash2,
  Download,
  Upload,
  Sparkles,
} from "lucide-react";

import {
  Button,
  IconButton,
  Input,
  Textarea,
  FieldLabel,
  FieldHelp,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Badge,
  Chip,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Separator,
  Kbd,
  Skeleton,
  Spinner,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Switch,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <header className="mb-6">
        <h2 className="serif-title text-[28px] leading-tight text-[var(--color-ink-1000)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--fg-muted)] mt-1">{description}</p>
        )}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Demo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono text-[var(--fg-subtle)] uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-start flex-wrap gap-3 p-6 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)]">
        {children}
      </div>
    </div>
  );
}

export default function ComponentsShowcasePage() {
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--fg-default)] font-sans">
      <div className="max-w-[1080px] mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-12 pb-4 border-b border-[var(--border-default)]">
          <div className="text-[11px] font-mono text-[var(--fg-subtle)] uppercase tracking-wider mb-2">
            Crónica DS · primitivos
          </div>
          <h1 className="serif-title text-[48px] leading-[1.05] text-[var(--color-ink-1000)]">
            Componentes
          </h1>
          <p className="text-[15px] text-[var(--fg-muted)] mt-2 max-w-[60ch]">
            Showcase de los primitivos UI del sistema. Cada componente con
            variantes, tamaños y estados. Validar visualmente light y dark mode.
          </p>
        </header>

        {/* BUTTONS */}
        <Section title="Button" description="Acción principal, variantes y estados.">
          <Demo label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="danger-outline">Danger outline</Button>
          </Demo>

          <Demo label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Demo>

          <Demo label="Con iconos">
            <Button leadingIcon={<Plus />}>Crear nuevo</Button>
            <Button variant="secondary" trailingIcon={<ArrowRight />}>
              Continuar
            </Button>
            <Button variant="ghost" leadingIcon={<Filter />}>
              Filtros
            </Button>
          </Demo>

          <Demo label="States">
            <Button>Default</Button>
            <Button isLoading>Cargando</Button>
            <Button disabled>Disabled</Button>
          </Demo>
        </Section>

        {/* ICON BUTTON */}
        <Section title="IconButton" description="Cuadrado, solo icono. aria-label obligatorio.">
          <Demo label="Variants × sizes">
            <IconButton aria-label="Buscar" size="sm" variant="ghost">
              <Search />
            </IconButton>
            <IconButton aria-label="Buscar" size="md" variant="ghost">
              <Search />
            </IconButton>
            <IconButton aria-label="Buscar" size="lg" variant="ghost">
              <Search />
            </IconButton>
            <IconButton aria-label="Crear" variant="primary">
              <Plus />
            </IconButton>
            <IconButton aria-label="Configurar" variant="secondary">
              <Settings />
            </IconButton>
            <IconButton aria-label="Eliminar" variant="danger">
              <Trash2 />
            </IconButton>
          </Demo>
        </Section>

        {/* INPUT */}
        <Section title="Input" description="Texto, búsqueda, con icono leading/trailing, error.">
          <Demo label="Sizes">
            <Input placeholder="Small" size="sm" />
            <Input placeholder="Medium (default)" size="md" />
            <Input placeholder="Large" size="lg" />
          </Demo>

          <Demo label="Con iconos">
            <Input
              placeholder="Buscar fuentes…"
              leadingIcon={<Search />}
              wrapperClassName="max-w-xs"
            />
            <Input
              placeholder="Filtrar"
              trailingIcon={<Filter />}
              wrapperClassName="max-w-xs"
            />
          </Demo>

          <Demo label="Con label y help">
            <div className="w-full max-w-sm">
              <FieldLabel htmlFor="ex1" required>
                Nombre de la conversación
              </FieldLabel>
              <Input id="ex1" placeholder="ej. Independencia y crisis monetaria" />
              <FieldHelp>Visible en la barra lateral.</FieldHelp>
            </div>
            <div className="w-full max-w-sm">
              <FieldLabel htmlFor="ex2">Año</FieldLabel>
              <Input id="ex2" placeholder="1991" error />
              <FieldHelp error>El año debe estar entre 1500 y 2025.</FieldHelp>
            </div>
          </Demo>

          <Demo label="Textarea">
            <Textarea
              placeholder="Pregunta sobre historia colombiana…"
              className="max-w-md"
              rows={3}
            />
          </Demo>
        </Section>

        {/* CARD */}
        <Section title="Card" description="Default, elevated, inset, outline + banda de período.">
          <Demo label="Variants">
            <Card variant="default" className="w-72">
              <CardTitle as="h4">Default</CardTitle>
              <CardDescription>Card estándar con border + elev-1.</CardDescription>
              <CardBody>Contenido del card.</CardBody>
            </Card>

            <Card variant="elevated" className="w-72">
              <CardTitle as="h4">Elevated</CardTitle>
              <CardDescription>Sin border, con elev-2.</CardDescription>
              <CardBody>Para uso destacado.</CardBody>
            </Card>

            <Card variant="inset" className="w-72">
              <CardTitle as="h4">Inset</CardTitle>
              <CardDescription>Background subtle, sin border.</CardDescription>
              <CardBody>Card dentro de card.</CardBody>
            </Card>

            <Card variant="outline" className="w-72">
              <CardTitle as="h4">Outline</CardTitle>
              <CardDescription>Transparente + border.</CardDescription>
              <CardBody>Empty states.</CardBody>
            </Card>
          </Demo>

          <Demo label="Con period">
            <Card periodColor="ind" className="w-80">
              <CardTitle as="h4">Independencia</CardTitle>
              <CardDescription>1810 — 1830</CardDescription>
              <CardBody>Card con banda izquierda 4px del período.</CardBody>
            </Card>
            <Card periodColor="c91" className="w-80">
              <CardTitle as="h4">Constitución de 1991</CardTitle>
              <CardDescription>1991 — presente</CardDescription>
              <CardBody>Mismo patrón, otro período.</CardBody>
            </Card>
          </Demo>

          <Demo label="Interactive">
            <Card interactive className="w-80" onClick={() => toast.success("Card clickeado")}>
              <CardTitle as="h4">Clickeable</CardTitle>
              <CardDescription>Hover sube elevación.</CardDescription>
            </Card>
          </Demo>
        </Section>

        {/* BADGE & CHIP */}
        <Section title="Badge & Chip" description="Indicadores no-interactivos y chips removibles.">
          <Demo label="Variants">
            <Badge variant="solid">Solid</Badge>
            <Badge variant="subtle">Subtle</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="tinta">Tinta</Badge>
            <Badge variant="success">Verificado</Badge>
            <Badge variant="warning">Pendiente</Badge>
            <Badge variant="danger">Error</Badge>
            <Badge variant="info">Info</Badge>
          </Demo>

          <Demo label="Sizes">
            <Badge size="xs">XS</Badge>
            <Badge size="sm">SM</Badge>
            <Badge size="md">MD</Badge>
          </Demo>

          <Demo label="Period badges (subtle)">
            {[
              { code: "pre", label: "Prehispánico" },
              { code: "ind", label: "Independencia" },
              { code: "rep-lib", label: "República Liberal" },
              { code: "vio", label: "La Violencia" },
              { code: "c91", label: "Constitución 91" },
              { code: "pos", label: "Posconflicto" },
            ].map((p) => (
              <span
                key={p.code}
                className="inline-flex items-center px-2 h-[22px] text-xs font-medium rounded-sm"
                style={{
                  background: `color-mix(in oklab, var(--color-period-${p.code}) 12%, transparent)`,
                  color: `var(--color-period-${p.code})`,
                }}
              >
                {p.label}
              </span>
            ))}
          </Demo>

          <Demo label="Chips removibles">
            <Chip variant="tinta" onRemove={() => toast("Chip removido")}>
              Filtro: período colonial
            </Chip>
            <Chip variant="subtle" onRemove={() => {}}>
              1810 — 1830
            </Chip>
            <Chip variant="success">Sin remove (no clickable)</Chip>
          </Demo>
        </Section>

        {/* TOOLTIP */}
        <Section title="Tooltip" description="Hover/focus. Radix portal. z-50, fade + slide.">
          <Demo label="Posiciones">
            <Tooltip content="Tooltip arriba" side="top">
              <Button variant="secondary">Top</Button>
            </Tooltip>
            <Tooltip content="Tooltip a la derecha" side="right">
              <Button variant="secondary">Right</Button>
            </Tooltip>
            <Tooltip content="Tooltip abajo" side="bottom">
              <Button variant="secondary">Bottom</Button>
            </Tooltip>
            <Tooltip content="Tooltip a la izquierda" side="left">
              <Button variant="secondary">Left</Button>
            </Tooltip>
          </Demo>

          <Demo label="En IconButton (caso real)">
            <Tooltip content="Configuración (⌘,)">
              <IconButton aria-label="Configuración">
                <Settings />
              </IconButton>
            </Tooltip>
            <Tooltip content="Eliminar permanentemente">
              <IconButton aria-label="Eliminar" variant="danger">
                <Trash2 />
              </IconButton>
            </Tooltip>
          </Demo>
        </Section>

        {/* POPOVER */}
        <Section title="Popover" description="Interactivo, puede contener inputs/buttons.">
          <Demo label="Trigger + content">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" leadingIcon={<Filter />}>
                  Filtros
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Filtrar resultados</h4>
                  <div className="space-y-2">
                    <FieldLabel>Período</FieldLabel>
                    <Input placeholder="ej. independencia" size="sm" />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Año desde</FieldLabel>
                    <Input placeholder="1810" size="sm" />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button size="sm" variant="ghost">
                      Limpiar
                    </Button>
                    <Button size="sm">Aplicar</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </Demo>
        </Section>

        {/* DIALOG */}
        <Section title="Dialog" description="Modal con focus trap. 4 tamaños.">
          <Demo label="Abrir dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Abrir dialog (md)</Button>
              </DialogTrigger>
              <DialogContent size="md">
                <DialogHeader>
                  <DialogTitle>¿Eliminar conversación?</DialogTitle>
                  <DialogDescription>
                    Esta acción no se puede deshacer. Se eliminarán los mensajes
                    y referencias a fuentes.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <p className="text-sm">
                    La conversación contiene 23 mensajes y 12 fuentes citadas.
                  </p>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger">Eliminar</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Demo>
        </Section>

        {/* DRAWER */}
        <Section title="Drawer" description="Panel lateral. Right (default), left, bottom.">
          <Demo label="Sides">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">Drawer right</Button>
              </DrawerTrigger>
              <DrawerContent side="right">
                <DrawerHeader>
                  <DrawerTitle>Fuente bibliográfica</DrawerTitle>
                  <DrawerDescription>
                    Detalle de la cita expandido.
                  </DrawerDescription>
                </DrawerHeader>
                <DrawerBody>
                  <article className="prose-academic max-w-none">
                    <h3>Constitución Política de Colombia, 1991</h3>
                    <p>
                      Documento promulgado el 4 de julio de 1991, reemplazando
                      la Constitución de 1886. Estableció el Estado social de
                      derecho y la Corte Constitucional.
                    </p>
                  </article>
                </DrawerBody>
                <DrawerFooter>
                  <Button variant="ghost">Cerrar</Button>
                  <Button>Ver documento original</Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>

            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">Drawer left</Button>
              </DrawerTrigger>
              <DrawerContent side="left">
                <DrawerHeader>
                  <DrawerTitle>Navegación lateral</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>Contenido</DrawerBody>
              </DrawerContent>
            </Drawer>

            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">Drawer bottom</Button>
              </DrawerTrigger>
              <DrawerContent side="bottom" size="md">
                <DrawerHeader>
                  <DrawerTitle>Confirmación móvil</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>Bottom sheet para mobile.</DrawerBody>
              </DrawerContent>
            </Drawer>
          </Demo>
        </Section>

        {/* DROPDOWN */}
        <Section title="DropdownMenu" description="Menú con items, labels, shortcuts.">
          <Demo label="Trigger">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Acciones ▾</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Conversación</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Download /> Exportar
                  <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Upload /> Compartir
                  <DropdownMenuShortcut>⌘⇧S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Sparkles /> Resumir con IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger>
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Demo>
        </Section>

        {/* TABS */}
        <Section title="Tabs" description="Underline (default), pill, segmented.">
          <Demo label="Underline">
            <div className="w-full">
              <Tabs defaultValue="todas">
                <TabsList>
                  <TabsTrigger value="todas">Todas</TabsTrigger>
                  <TabsTrigger value="conv">Conversaciones</TabsTrigger>
                  <TabsTrigger value="fuentes">Fuentes</TabsTrigger>
                  <TabsTrigger value="ent">Entidades</TabsTrigger>
                </TabsList>
                <TabsContent value="todas">
                  <p className="text-sm text-[var(--fg-muted)]">
                    Listado de todos los resultados.
                  </p>
                </TabsContent>
                <TabsContent value="conv">
                  <p className="text-sm text-[var(--fg-muted)]">
                    Conversaciones.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </Demo>

          <Demo label="Pill">
            <Tabs defaultValue="dia" className="w-full">
              <TabsList variant="pill">
                <TabsTrigger value="dia" variant="pill">
                  Día
                </TabsTrigger>
                <TabsTrigger value="sem" variant="pill">
                  Semana
                </TabsTrigger>
                <TabsTrigger value="mes" variant="pill">
                  Mes
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Demo>

          <Demo label="Segmented">
            <Tabs defaultValue="grid" className="w-fit">
              <TabsList variant="segmented">
                <TabsTrigger value="grid" variant="segmented">
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" variant="segmented">
                  Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Demo>
        </Section>

        {/* FORM */}
        <Section title="Form controls" description="Switch, Checkbox, RadioGroup.">
          <Demo label="Switch">
            <div className="flex items-center gap-3">
              <Switch
                checked={switchChecked}
                onCheckedChange={setSwitchChecked}
                id="sw1"
              />
              <label htmlFor="sw1" className="text-sm cursor-pointer">
                Mostrar fuentes inline ({switchChecked ? "ON" : "OFF"})
              </label>
            </div>
            <Switch size="sm" defaultChecked />
            <Switch disabled />
          </Demo>

          <Demo label="Checkbox">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cb1"
                checked={checkboxChecked}
                onCheckedChange={(v) => setCheckboxChecked(v === true)}
              />
              <label htmlFor="cb1" className="text-sm cursor-pointer">
                Recordar mi sesión
              </label>
            </div>
            <Checkbox size="sm" defaultChecked />
            <Checkbox checked="indeterminate" />
            <Checkbox disabled defaultChecked />
          </Demo>

          <Demo label="RadioGroup">
            <RadioGroup defaultValue="ind">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pre" id="r-pre" />
                <label htmlFor="r-pre" className="text-sm cursor-pointer">
                  Prehispánico
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="col" id="r-col" />
                <label htmlFor="r-col" className="text-sm cursor-pointer">
                  Colonia
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ind" id="r-ind" />
                <label htmlFor="r-ind" className="text-sm cursor-pointer">
                  Independencia
                </label>
              </div>
            </RadioGroup>
          </Demo>
        </Section>

        {/* AVATAR */}
        <Section title="Avatar" description="Imagen o fallback con initials.">
          <Demo label="Sizes">
            <Avatar size="xs">
              <AvatarFallback>MG</AvatarFallback>
            </Avatar>
            <Avatar size="sm">
              <AvatarFallback>MG</AvatarFallback>
            </Avatar>
            <Avatar size="md">
              <AvatarFallback>MG</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>MG</AvatarFallback>
            </Avatar>
            <Avatar size="xl">
              <AvatarFallback>MG</AvatarFallback>
            </Avatar>
          </Demo>

          <Demo label="Shape square (entidades institucionales)">
            <Avatar shape="square" size="md">
              <AvatarFallback>BR</AvatarFallback>
            </Avatar>
            <Avatar shape="square" size="lg">
              <AvatarFallback>UN</AvatarFallback>
            </Avatar>
          </Demo>
        </Section>

        {/* SKELETON */}
        <Section title="Skeleton" description="Loading state. Shimmer animation.">
          <Demo label="Variants">
            <div className="space-y-2 w-64">
              <Skeleton variant="line" />
              <Skeleton variant="line" className="w-3/4" />
              <Skeleton variant="line" className="w-1/2" />
            </div>
            <Skeleton variant="block" className="size-20" />
            <Skeleton variant="circle" className="size-12" />
          </Demo>

          <Demo label="Card skeleton">
            <Card className="w-80">
              <div className="flex gap-3">
                <Skeleton variant="circle" className="size-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="line" className="w-3/4" />
                  <Skeleton variant="line" className="w-1/2" />
                </div>
              </div>
            </Card>
          </Demo>
        </Section>

        {/* SPINNER */}
        <Section title="Spinner" description="Indicador rotativo. Hereda color.">
          <Demo label="Sizes">
            <Spinner size={14} className="text-[var(--fg-default)]" />
            <Spinner size={16} className="text-[var(--accent)]" />
            <Spinner size={20} className="text-[var(--color-success-fg)]" />
            <Spinner size={24} className="text-[var(--color-warning-fg)]" />
          </Demo>
        </Section>

        {/* KBD */}
        <Section title="Kbd" description="Atajos de teclado. Símbolos automáticos.">
          <Demo label="Combinaciones">
            <Kbd keys={["cmd", "k"]} />
            <Kbd keys={["cmd", "shift", "p"]} />
            <Kbd keys="escape" />
            <Kbd keys={["arrowup"]} />
            <Kbd>?</Kbd>
            <Kbd>/</Kbd>
          </Demo>
        </Section>

        {/* SEPARATOR */}
        <Section title="Separator" description="Divisor horizontal/vertical.">
          <Demo label="Horizontal">
            <div className="w-full max-w-md space-y-3">
              <p className="text-sm">Item arriba</p>
              <Separator />
              <p className="text-sm">Item abajo</p>
            </div>
          </Demo>

          <Demo label="Vertical">
            <div className="flex items-center gap-4 h-8">
              <span className="text-sm">Inicio</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Medio</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Final</span>
            </div>
          </Demo>
        </Section>

        {/* TOAST */}
        <Section title="Toast (sonner)" description="Notificaciones con sonner. position: bottom-right.">
          <Demo label="Variants">
            <Button onClick={() => toast("Mensaje neutro")}>Default</Button>
            <Button
              variant="secondary"
              onClick={() => toast.success("Fuente añadida a la bibliografía")}
            >
              Success
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.warning("Documento sin procesar")}
            >
              Warning
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.error("No pudimos cargar el documento", {
                  description: "Verificá la conexión y reintentá.",
                })
              }
            >
              Error
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast("Conversación archivada", {
                  action: {
                    label: "Deshacer",
                    onClick: () => toast.success("Restaurada"),
                  },
                })
              }
            >
              Con acción
            </Button>
          </Demo>
        </Section>

        <footer className="mt-16 pt-6 border-t border-[var(--border-default)] text-[11px] font-mono text-[var(--fg-subtle)]">
          Crónica DS · /dev/components · Documentación en{" "}
          <code>docs/design-system/components.md</code>
        </footer>
      </div>
    </div>
  );
}
