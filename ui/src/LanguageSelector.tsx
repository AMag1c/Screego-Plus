import React from 'react';
import {Select, MenuItem, FormControl} from '@mui/material';
import {useTranslation} from 'react-i18next';

export const LanguageSelector = () => {
    const {i18n} = useTranslation();

    const languages = [
        { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
        { code: 'en-US', name: 'English', flag: '🇺🇸' }
    ];

    const handleChange = (event: any) => {
        i18n.changeLanguage(event.target.value);
    };

    return (
        <FormControl size="small" style={{minWidth: 120}}>
            <Select
                value={i18n.language}
                onChange={handleChange}
                variant="outlined"
                style={{fontSize: '14px'}}
            >
                {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                        <span style={{marginRight: 8}}>{lang.flag}</span>
                        {lang.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};