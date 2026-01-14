import { Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { CompanyDataEditor } from './CompanyDataEditor';

export function ConfigurationsViewSimple() {
  return (
    <div className="bg-theme-primary text-theme-primary p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-blue-600">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Configurações</h1>
            <p className="text-gray-400">Gerencie as informações da sua empresa</p>
          </div>
        </motion.div>

        {/* Dados da Empresa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CompanyDataEditor />
        </motion.div>
      </div>
    </div>
  );
}

export default ConfigurationsViewSimple;
