import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PropertyFormFieldsProps {
  formData: {
    propertyCode: string;
    title: string;
    type: string;
    property_purpose: string;
    price: string;
    area: string;
    bedrooms: string;
    bathrooms: string;
    address: string;
    city: string;
    state: string;
    status: string;
    description: string;
    proprietario_nome: string;
    proprietario_estado_civil: string;
    proprietario_cpf: string;
    proprietario_endereco: string;
    proprietario_email: string;
  };
  onChange: (field: string, value: string) => void;
  readOnlyCode?: boolean;
  onCodeBlur?: () => void;
  checkingCode?: boolean;
  step?: number;
}

export function PropertyFormFields({ 
  formData, 
  onChange, 
  readOnlyCode = false,
  onCodeBlur,
  checkingCode = false,
  step = 1
}: PropertyFormFieldsProps) {
  
  // Step 1: Dados básicos do imóvel
  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
      <div className="space-y-2">
        <Label htmlFor="propertyCode" className="text-gray-300">Código de Referência *</Label>
        <Input
          id="propertyCode"
          value={formData.propertyCode}
          onChange={(e) => onChange("propertyCode", e.target.value)}
          onBlur={onCodeBlur}
          placeholder="Ex: 123456, CASA001, APT123"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
          required
          readOnly={readOnlyCode}
          disabled={checkingCode}
        />
        {checkingCode && (
          <p className="text-sm text-gray-400">Verificando código...</p>
        )}
        <p className="text-xs text-gray-500">Este código será incluído no título da propriedade para facilitar a identificação</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title" className="text-gray-300">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Ex: Casa Moderna em Condomínio"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type" className="text-gray-300">Tipo *</Label>
        <Select value={formData.type} onValueChange={(value) => onChange("type", value)}>
          <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="house">Casa</SelectItem>
            <SelectItem value="apartment">Apartamento</SelectItem>
            <SelectItem value="commercial">Comercial</SelectItem>
            <SelectItem value="land">Terreno</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="property_purpose" className="text-gray-300">Finalidade *</Label>
        <Select value={formData.property_purpose} onValueChange={(value) => onChange("property_purpose", value)}>
          <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
            <SelectValue placeholder="Selecione a finalidade" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="Aluguel">🏠 Aluguel</SelectItem>
            <SelectItem value="Venda">🏢 Venda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price" className="text-gray-300">Preço (R$) *</Label>
        <Input
          id="price"
          type="number"
          value={formData.price}
          onChange={(e) => onChange("price", e.target.value)}
          placeholder="850000"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="area" className="text-gray-300">Área (m²) *</Label>
        <Input
          id="area"
          type="number"
          value={formData.area}
          onChange={(e) => onChange("area", e.target.value)}
          placeholder="250"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bedrooms" className="text-gray-300">Quartos</Label>
        <Input
          id="bedrooms"
          type="number"
          value={formData.bedrooms}
          onChange={(e) => onChange("bedrooms", e.target.value)}
          placeholder="4"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bathrooms" className="text-gray-300">Banheiros</Label>
        <Input
          id="bathrooms"
          type="number"
          value={formData.bathrooms}
          onChange={(e) => onChange("bathrooms", e.target.value)}
          placeholder="3"
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status" className="text-gray-300">Situação</Label>
        <Select value={formData.status} onValueChange={(value) => onChange("status", value)}>
          <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
            <SelectValue placeholder="Selecione a situação" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="sold">Vendido</SelectItem>
            <SelectItem value="rented">Alugado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="description" className="text-gray-300">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Descreva as características e diferenciais do imóvel..."
          className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400 min-h-[100px]"
        />
      </div>
    </div>
  );

  // Step 2: Localização e Dados do Proprietário
  const renderStep2 = () => (
    <div className="space-y-8 pb-4">
      {/* Seção de Localização */}
      <div>
        <h4 className="text-lg font-semibold text-white mb-4 border-b border-gray-600/50 pb-2">
          📍 Localização
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-300">Endereço *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => onChange("address", e.target.value)}
              placeholder="Rua das Flores, 123"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="text-gray-300">Cidade *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => onChange("city", e.target.value)}
              placeholder="São Paulo"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state" className="text-gray-300">Estado *</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => onChange("state", e.target.value)}
              placeholder="SP"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Seção de Dados do Proprietário */}
      <div>
        <h4 className="text-lg font-semibold text-white mb-4 border-b border-gray-600/50 pb-2">
          👤 Dados do Proprietário
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="proprietario_nome" className="text-gray-300">Nome do Proprietário</Label>
            <Input
              id="proprietario_nome"
              value={formData.proprietario_nome}
              onChange={(e) => onChange("proprietario_nome", e.target.value)}
              placeholder="João Silva"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proprietario_cpf" className="text-gray-300">CPF do Proprietário</Label>
            <Input
              id="proprietario_cpf"
              value={formData.proprietario_cpf}
              onChange={(e) => onChange("proprietario_cpf", e.target.value)}
              placeholder="000.000.000-00"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proprietario_estado_civil" className="text-gray-300">Estado Civil</Label>
            <Select value={formData.proprietario_estado_civil} onValueChange={(value) => onChange("proprietario_estado_civil", value)}>
              <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="Selecione o estado civil" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="uniao_estavel">União Estável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proprietario_email" className="text-gray-300">Email do Proprietário</Label>
            <Input
              id="proprietario_email"
              type="email"
              value={formData.proprietario_email}
              onChange={(e) => onChange("proprietario_email", e.target.value)}
              placeholder="joao@email.com"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="proprietario_endereco" className="text-gray-300">Endereço do Proprietário</Label>
            <Input
              id="proprietario_endereco"
              value={formData.proprietario_endereco}
              onChange={(e) => onChange("proprietario_endereco", e.target.value)}
              placeholder="Rua dos Proprietários, 456"
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar baseado no step
  switch (step) {
    case 1:
      return renderStep1();
    case 2:
      return renderStep2();
    default:
      return renderStep1();
  }
}
