import { useFmt } from "../i18n";

export function RequestStatus({error,loading,retry}:{error?:Error;loading?:boolean;retry?:()=>void}) {
 const {t,lang}=useFmt();
 if(error)return <div className="request-status" role="alert"><p>{t('app.error',{msg:error.message})}</p>{retry&&<button type="button" className="btn" onClick={retry}>{lang==='bn'?'আবার চেষ্টা':'Retry'}</button>}</div>;
 if(loading)return <div className="request-skeleton" role="status" aria-label={t('app.loading')}><span/><span/><span/><span className="sr-only">{t('app.loading')}</span></div>;
 return null;
}
export function ConnectionStatus() {
 const {lang}=useFmt();
 return <p className="offline-status">{lang==='bn'?'অফলাইনে সংরক্ষিত তথ্য দেখানো হচ্ছে; হালনাগাদের তারিখ দেখুন।':'Offline: viewing cached data. Check the publication date.'}</p>;
}
