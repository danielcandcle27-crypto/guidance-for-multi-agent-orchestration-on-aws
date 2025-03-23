//
// cloudscape-imports.ts
//

// ----------- AppLayout -----------
import AppLayout from "@cloudscape-design/components/app-layout";
import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";

// ----------- AttributeEditor -----------
import AttributeEditor from "@cloudscape-design/components/attribute-editor";

// ----------- Box -----------
import Box from "@cloudscape-design/components/box";
import type { BoxProps } from "@cloudscape-design/components/box";
// If you previously used BoxDisplayProperty:
type BoxDisplayProperty = BoxProps["display"];

// ----------- Button -----------
import Button from "@cloudscape-design/components/button";
import type { ButtonProps } from "@cloudscape-design/components/button";

// ----------- Cards -----------
import Cards from "@cloudscape-design/components/cards";
import type { CardsProps } from "@cloudscape-design/components/cards";

// ----------- Checkbox -----------
import Checkbox from "@cloudscape-design/components/checkbox";

// ----------- CollectionPreferences -----------
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import type { CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";

// ----------- ColumnLayout -----------
import ColumnLayout from "@cloudscape-design/components/column-layout";

// ----------- Container -----------
import Container from "@cloudscape-design/components/container";
import type { ContainerProps } from "@cloudscape-design/components/container";

// ----------- ExpandableSection -----------
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import type { ExpandableSectionProps } from "@cloudscape-design/components/expandable-section";

// ----------- FormField -----------
import FormField from "@cloudscape-design/components/form-field";

// ----------- Grid -----------
import Grid from "@cloudscape-design/components/grid";
import type { GridProps } from "@cloudscape-design/components/grid";

// ----------- Header -----------
import Header from "@cloudscape-design/components/header";
import type { HeaderProps } from "@cloudscape-design/components/header";

// ----------- Input -----------
import Input from "@cloudscape-design/components/input";

// ----------- Link -----------
import Link from "@cloudscape-design/components/link";

// ----------- Modal -----------
import Modal from "@cloudscape-design/components/modal";

// ----------- Pagination -----------
import Pagination from "@cloudscape-design/components/pagination";
import type { PaginationProps } from "@cloudscape-design/components/pagination";

// ----------- Select -----------
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";

// ----------- SideNavigation -----------
import SideNavigation from "@cloudscape-design/components/side-navigation";

// ----------- SpaceBetween -----------
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { SpaceBetweenProps } from "@cloudscape-design/components/space-between";

// ----------- StatusIndicator -----------
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import type { StatusIndicatorProps } from "@cloudscape-design/components/status-indicator";

// ----------- Table -----------
import Table from "@cloudscape-design/components/table";

// ----------- Tabs -----------
import Tabs from "@cloudscape-design/components/tabs";
import type { TabsProps } from "@cloudscape-design/components/tabs";

// ----------- TextContent -----------
import TextContent from "@cloudscape-design/components/text-content";

// ----------- TextFilter -----------
import TextFilter from "@cloudscape-design/components/text-filter";
import type { TextFilterProps } from "@cloudscape-design/components/text-filter";

// ----------- Textarea -----------
import Textarea from "@cloudscape-design/components/textarea";

// ------------------- Re-exports -------------------

// Components
export {
  AppLayout,
  AttributeEditor,
  Box,
  Button,
  Cards,
  Checkbox,
  CollectionPreferences,
  ColumnLayout,
  Container,
  ExpandableSection,
  FormField,
  Grid,
  Header,
  Input,
  Link,
  Modal,
  Pagination,
  Select,
  SideNavigation,
  SpaceBetween,
  StatusIndicator,
  Table,
  Tabs,
  TextContent,
  TextFilter,
  Textarea
};

// Types
export type {
  AppLayoutProps,
  BoxProps,
  ButtonProps,
  CardsProps,
  CollectionPreferencesProps,
  ContainerProps,
  ExpandableSectionProps,
  GridProps,
  HeaderProps,
  PaginationProps,
  SelectProps,
  SpaceBetweenProps,
  StatusIndicatorProps,
  TabsProps,
  TextFilterProps
};
export type { BoxDisplayProperty };

// Alias for backward compatibility
export const CloudBox = Box;
