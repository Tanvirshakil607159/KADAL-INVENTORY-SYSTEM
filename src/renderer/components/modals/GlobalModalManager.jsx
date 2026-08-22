import React from 'react';
import useStore from '../../store/useStore';
import ItemFormModal from './ItemFormModal';
import StockMovementModal from './StockMovementModal';
import UserFormModal from './UserFormModal';
import SupplierFormModal from './SupplierFormModal';
import ApprovalReviewModal from './ApprovalReviewModal';
import ChallanBrowserModal from './ChallanBrowserModal';
import IssueBrowserModal from './IssueBrowserModal';
import ProductionEntryModal from './ProductionEntryModal';
import BarcodeModal from './BarcodeModal';
import TargetProductBrowserModal from './TargetProductBrowserModal';
import RecipientFormModal from './RecipientFormModal';

export default function GlobalModalManager() {
  const { modal } = useStore();
  
  if (!modal) return null;

  switch (modal.type) {
    case 'ITEM_FORM':
      return <ItemFormModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'STOCK_MOVEMENT':
      return <StockMovementModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'USER_FORM':
      return <UserFormModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'SUPPLIER_FORM':
      return <SupplierFormModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'RECIPIENT_FORM':
      return <RecipientFormModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'APPROVAL_REVIEW':
      return <ApprovalReviewModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'CHALLAN_BROWSER':
      return <ChallanBrowserModal data={modal.data} />;
    case 'ISSUE_BROWSER':
      return <IssueBrowserModal data={modal.data} />;
    case 'PRODUCTION_ENTRY':
      return <ProductionEntryModal data={modal.data} onSaved={modal.data.onSaved} />;
    case 'BARCODE':
      return <BarcodeModal isOpen={true} onClose={() => useStore.getState().closeModal()} item={modal.data} />;
    case 'TARGET_PRODUCT_BROWSER':
      return <TargetProductBrowserModal data={modal.data} />;
    default:
      return null;
  }
}
